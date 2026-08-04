<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCards } from '@/services/cardService'
import { buildReviewQueue } from '@/services/reviewService'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewFilter } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const cards = ref<KnowledgeCard[]>([])
const subjectId = ref('all')
const chapterId = ref('all')
const tag = ref('all')
const queueCount = ref(0)
const loading = ref(true)

const subjectOptions = computed(() => ['全部科目', ...subjects.value.map((item) => item.name)])
const availableChapters = computed(() =>
  subjectId.value === 'all'
    ? []
    : chapters.value.filter((item) => item.subjectId === subjectId.value),
)
const chapterOptions = computed(() => [
  '全部章节',
  '未分类',
  ...availableChapters.value.map((item) => item.name),
])
const availableTags = computed(() => {
  const values = cards.value
    .filter((card) => subjectId.value === 'all' || card.subjectId === subjectId.value)
    .filter((card) => {
      if (chapterId.value === 'all') return true
      if (chapterId.value === 'uncategorized') return !card.chapterId
      return card.chapterId === chapterId.value
    })
    .flatMap((card) => card.tags)
  return [...new Set(values)].sort((first, second) => first.localeCompare(second, 'zh-CN'))
})
const tagOptions = computed(() => ['全部标签', ...availableTags.value])
const selectedSubjectName = computed(() =>
  subjectId.value === 'all'
    ? '全部科目'
    : subjects.value.find((item) => item.id === subjectId.value)?.name ?? '全部科目',
)
const selectedChapterName = computed(() => {
  if (chapterId.value === 'all') return '全部章节'
  if (chapterId.value === 'uncategorized') return '未分类'
  return availableChapters.value.find((item) => item.id === chapterId.value)?.name ?? '全部章节'
})
const selectedTagName = computed(() => (tag.value === 'all' ? '全部标签' : tag.value))

function currentFilter(): ReviewFilter {
  return {
    subjectId: subjectId.value === 'all' ? undefined : subjectId.value,
    chapterId:
      !['all', 'uncategorized'].includes(chapterId.value) ? chapterId.value : undefined,
    uncategorizedOnly: chapterId.value === 'uncategorized' || undefined,
    tag: tag.value === 'all' ? undefined : tag.value,
  }
}

async function refreshCount(): Promise<void> {
  if (loading.value) return
  queueCount.value = (await buildReviewQueue(Date.now(), currentFilter())).length
}

watch([subjectId, chapterId, tag], refreshCount)

onLoad(async (query) => {
  ;[subjects.value, chapters.value, cards.value] = await Promise.all([
    getSubjects(),
    getChapters(),
    getCards(),
  ])
  const requestedSubjectId = String(query?.subjectId ?? '')
  if (subjects.value.some((item) => item.id === requestedSubjectId)) {
    subjectId.value = requestedSubjectId
  }
  loading.value = false
  await refreshCount()
})

function changeSubject(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  subjectId.value = index === 0 ? 'all' : subjects.value[index - 1]?.id ?? 'all'
  chapterId.value = 'all'
  tag.value = 'all'
}

function changeChapter(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  chapterId.value =
    index === 0
      ? 'all'
      : index === 1
        ? 'uncategorized'
        : availableChapters.value[index - 2]?.id ?? 'all'
  tag.value = 'all'
}

function changeTag(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  tag.value = index === 0 ? 'all' : availableTags.value[index - 1] ?? 'all'
}

function startStudy(): void {
  if (!queueCount.value) {
    uni.showToast({ title: '当前范围内没有待复习卡片', icon: 'none' })
    return
  }
  const filter = currentFilter()
  const parts = ['fresh=1']
  if (filter.subjectId) parts.push(`subjectId=${encodeURIComponent(filter.subjectId)}`)
  if (filter.chapterId) parts.push(`chapterId=${encodeURIComponent(filter.chapterId)}`)
  if (filter.uncategorizedOnly) parts.push('uncategorized=1')
  if (filter.tag) parts.push(`tag=${encodeURIComponent(filter.tag)}`)
  uni.navigateTo({ url: `/pages/review/index?${parts.join('&')}` })
}
</script>

<template>
  <view class="page-shell study-page">
    <view class="page-heading">
      <text class="eyebrow">自由组卷</text>
      <text class="page-title">专项复习</text>
      <text class="page-subtitle">按科目、章节或标签聚焦当前最需要巩固的知识。</text>
    </view>

    <view class="filter-card surface">
      <text class="field-label first-label">科目范围</text>
      <picker :range="subjectOptions" @change="changeSubject">
        <view class="picker-field">{{ selectedSubjectName }} <text class="picker-arrow">⌄</text></view>
      </picker>

      <text class="field-label">章节范围</text>
      <picker :range="chapterOptions" :disabled="subjectId === 'all'" @change="changeChapter">
        <view class="picker-field" :class="{ disabled: subjectId === 'all' }">
          {{ subjectId === 'all' ? '请先选择一个科目' : selectedChapterName }}
          <text class="picker-arrow">⌄</text>
        </view>
      </picker>

      <text class="field-label">标签范围</text>
      <picker :range="tagOptions" @change="changeTag">
        <view class="picker-field">{{ selectedTagName }} <text class="picker-arrow">⌄</text></view>
      </picker>
    </view>

    <view class="queue-preview surface">
      <view>
        <text class="preview-label">本次待复习</text>
        <text class="preview-note">仍遵循到期卡优先和每日新卡限额</text>
      </view>
      <view class="preview-number-row">
        <text class="preview-number">{{ loading ? '—' : queueCount }}</text>
        <text class="preview-unit">张</text>
      </view>
    </view>

    <button class="primary-button start-button" :disabled="loading || !queueCount" @click="startStudy">
      开始专项复习
    </button>
  </view>
</template>

<style scoped>
.study-page {
  padding-bottom: 90rpx;
}

.filter-card {
  padding: 30rpx;
  border-top: 5rpx solid var(--color-primary);
}

.first-label {
  margin-top: 0;
}

.picker-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-field.disabled {
  background: #f2eee7;
  color: var(--color-subtle);
}

.picker-arrow {
  color: var(--color-muted);
}

.queue-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 28rpx 30rpx;
  border-left: 5rpx solid var(--color-accent);
}

.preview-label,
.preview-note {
  display: block;
}

.preview-label {
  font-size: 28rpx;
  font-weight: 740;
}

.preview-note {
  margin-top: 8rpx;
  color: var(--color-muted);
  font-size: 21rpx;
}

.preview-number-row {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  margin-left: 24rpx;
}

.preview-number {
  color: var(--color-primary);
  font-size: 50rpx;
  font-weight: 820;
}

.preview-unit {
  margin-left: 7rpx;
  color: var(--color-muted);
  font-size: 22rpx;
}

.start-button {
  width: 100%;
  margin-top: 28rpx;
}
</style>
