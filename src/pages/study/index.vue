<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import LoadErrorState from '@/components/LoadErrorState.vue'
import { buildReviewQueue } from '@/services/reviewService'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { ReviewFilter } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'
import { reviewRoute } from '@/utils/reviewFilter'

const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const subjectId = ref('')
const chapterId = ref('all')
const queueCount = ref(0)
const loading = ref(true)
const loadError = ref(false)
let countRequestId = 0
let requestedSubjectId = ''

const subjectOptions = computed(() => subjects.value.map((item) => item.name))
const availableChapters = computed(() =>
  !subjectId.value
    ? []
    : chapters.value.filter((item) => item.subjectId === subjectId.value),
)
const chapterOptions = computed(() => [
  '全部章节',
  '未分类',
  ...availableChapters.value.map((item) => item.name),
])
const selectedSubjectName = computed(() =>
  subjects.value.find((item) => item.id === subjectId.value)?.name ?? '请选择知识库',
)
const selectedChapterName = computed(() => {
  if (chapterId.value === 'all') return '全部章节'
  if (chapterId.value === 'uncategorized') return '未分类'
  return availableChapters.value.find((item) => item.id === chapterId.value)?.name ?? '全部章节'
})
function currentFilter(): ReviewFilter {
  return {
    subjectId: subjectId.value || undefined,
    chapterId:
      !['all', 'uncategorized'].includes(chapterId.value) ? chapterId.value : undefined,
    uncategorizedOnly: chapterId.value === 'uncategorized' || undefined,
  }
}

async function refreshCount(): Promise<void> {
  if (loading.value) return
  if (!subjectId.value) {
    queueCount.value = 0
    return
  }
  const requestId = ++countRequestId
  try {
    const count = (await buildReviewQueue(Date.now(), currentFilter())).length
    if (requestId === countRequestId) queueCount.value = count
  } catch {
    if (requestId === countRequestId) loadError.value = true
  }
}

watch([subjectId, chapterId], refreshCount)

async function load(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
    if (subjects.value.some((item) => item.id === requestedSubjectId)) {
      subjectId.value = requestedSubjectId
    } else if (subjects.value.length === 1) {
      subjectId.value = subjects.value[0]!.id
    } else {
      subjectId.value = ''
    }
    loading.value = false
    await refreshCount()
  } catch {
    loadError.value = true
    loading.value = false
  }
}

onLoad((query) => {
  requestedSubjectId = String(query?.subjectId ?? '')
  void load()
})

function changeSubject(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  subjectId.value = subjects.value[index]?.id ?? ''
  chapterId.value = 'all'
}

function changeChapter(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  chapterId.value =
    index === 0
      ? 'all'
      : index === 1
        ? 'uncategorized'
      : availableChapters.value[index - 2]?.id ?? 'all'
}

function startStudy(): void {
  if (!subjectId.value) {
    uni.showToast({ title: '请先选择一个知识库', icon: 'none' })
    return
  }
  if (!queueCount.value) {
    uni.showToast({ title: '当前范围内没有待复习卡片', icon: 'none' })
    return
  }
  const filter = currentFilter()
  uni.navigateTo({ url: reviewRoute(filter, true) })
}
</script>

<template>
  <view class="page-shell study-page">
    <view class="page-heading">
      <text class="eyebrow">沿脉络掌握</text>
      <text class="page-title">路径学习</text>
      <text class="page-subtitle">每次学习一个小节，全部记住后再进入下一节。</text>
    </view>

    <LoadErrorState v-if="loadError" @retry="load" />

    <template v-else>
    <view class="filter-card surface">
      <text class="field-label first-label">知识库</text>
      <picker :range="subjectOptions" :disabled="!subjectOptions.length" @change="changeSubject">
        <view class="picker-field">{{ selectedSubjectName }} <text class="picker-arrow">⌄</text></view>
      </picker>

      <text class="field-label">章节范围</text>
      <picker :range="chapterOptions" :disabled="!subjectId" @change="changeChapter">
        <view class="picker-field" :class="{ disabled: !subjectId }">
          {{ !subjectId ? '请先选择一个知识库' : selectedChapterName }}
          <text class="picker-arrow">⌄</text>
        </view>
      </picker>
    </view>

    <view class="queue-preview surface">
      <view>
        <text class="preview-label">本次学习</text>
        <text class="preview-note">到期内容优先，新知识按下一小节安排</text>
      </view>
      <view class="preview-number-row">
        <text class="preview-number">{{ loading ? '—' : queueCount }}</text>
        <text class="preview-unit">张</text>
      </view>
    </view>

    <button class="primary-button start-button" :disabled="loading || !subjectId || !queueCount" @click="startStudy">
      开始学习
    </button>
    </template>
  </view>
</template>

<style scoped>
.study-page {
  padding-bottom: 90rpx;
}

.filter-card {
  padding: 30rpx;
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
  background: #f2f3f1;
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
