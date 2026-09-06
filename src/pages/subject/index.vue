<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { createCardSearchIndex, normalizeSearchQuery } from '@/utils/cardSearch'
import KnowledgeCardItem from '@/components/KnowledgeCard.vue'
import { useCardStore } from '@/stores/card'
import { useSubjectStore } from '@/stores/subject'
import { getReviewStates, restoreMasteredCard } from '@/services/reviewService'
import { resetSubjectProgress } from '@/services/subjectService'

const subjectStore = useSubjectStore()
const cardStore = useCardStore()
const subjectId = ref('')
const selectedChapterId = ref('all')
const chapterName = ref('')
const editingChapterId = ref('')
const searchQuery = ref('')
const displayLimit = ref(20)
const masteredCardIds = ref(new Set<string>())
const { running: busy, run } = useAsyncAction()
const loading = ref(true)
const loadError = ref(false)
const statusFilter = ref('all')
const statusOptions = [
  { value: 'all', label: '全部' }, { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' }, { value: 'suspended', label: '已暂停' },
]

const subject = computed(() => subjectStore.subjects.find((item) => item.id === subjectId.value))
const chapters = computed(() =>
  subjectStore.chapters.filter((chapter) => chapter.subjectId === subjectId.value),
)
const searchIndex = computed(() => createCardSearchIndex(cardStore.cards))
const chapterCounts = computed(() => {
  const counts = new Map<string | undefined, number>()
  for (const card of cardStore.cards) counts.set(card.chapterId, (counts.get(card.chapterId) ?? 0) + 1)
  return counts
})
const selectedChapterName = computed(() => {
  if (selectedChapterId.value === 'all') return '全部知识卡'
  if (selectedChapterId.value === 'uncategorized') return '未分类'
  return chapters.value.find((item) => item.id === selectedChapterId.value)?.name ?? '知识卡'
})
const filteredCards = computed(() => {
  const query = normalizeSearchQuery(searchQuery.value)
  return searchIndex.value.filter(({ card, text }) => {
    const chapter = selectedChapterId.value
    if (chapter === 'uncategorized' && card.chapterId) return false
    if (!['all', 'uncategorized'].includes(chapter) && card.chapterId !== chapter) return false
    const status = card.status === 'suspended' ? 'suspended' : masteredCardIds.value.has(card.id) ? 'mastered' : 'learning'
    return (statusFilter.value === 'all' || status === statusFilter.value) && text.includes(query)
  }).map(({ card }) => card)
})
const displayedCards = computed(() => filteredCards.value.slice(0, displayLimit.value))
const hasMoreCards = computed(() => displayedCards.value.length < filteredCards.value.length)

watch([selectedChapterId, searchQuery, statusFilter], () => {
  displayLimit.value = 20
})

onLoad((query) => {
  subjectId.value = String(query?.id ?? '')
})

onShow(refresh)

async function refresh(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    if (!subjectId.value) throw new Error('科目不存在')
    const [, , states] = await Promise.all([
      subjectStore.load(), cardStore.load(subjectId.value), getReviewStates(),
    ])
    if (!subject.value) throw new Error('科目不存在')
    masteredCardIds.value = new Set(states.filter((state) => Boolean(state.masteredAt)).map((state) => state.cardId))
    if (!['all', 'uncategorized'].includes(selectedChapterId.value) && !chapters.value.some((chapter) => chapter.id === selectedChapterId.value)) {
      selectedChapterId.value = 'all'
    }
    uni.setNavigationBarTitle({ title: subject.value.name })
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function countFor(chapterId?: string): number {
  return chapterCounts.value.get(chapterId) ?? 0
}

async function saveChapter(): Promise<void> {
  await run(async () => {
    if (editingChapterId.value) {
      await subjectStore.editChapter(editingChapterId.value, chapterName.value)
    } else {
      await subjectStore.addChapter(subjectId.value, chapterName.value)
    }
    chapterName.value = ''
    editingChapterId.value = ''
  })
}

function beginChapterEdit(id: string): void {
  if (busy.value) return
  const chapter = chapters.value.find((item) => item.id === id)
  if (!chapter) return
  editingChapterId.value = id
  chapterName.value = chapter.name
}

function removeChapter(id: string): void {
  if (busy.value) return
  const chapter = chapters.value.find((item) => item.id === id)
  if (!chapter) return
  const cardCount = countFor(id)
  if (cardCount) {
    uni.showModal({
      title: '暂时不能删除',
      content: `“${chapter.name}”中还有 ${cardCount} 张知识卡，请先将它们移动到其他章节。`,
      showCancel: false,
    })
    return
  }
  uni.showModal({
    title: '删除章节',
    content: `确定删除空章节“${chapter.name}”吗？`,
    confirmColor: '#a3453e',
    success: async ({ confirm }) => {
      if (!confirm) return
      await run(async () => {
        await subjectStore.removeChapter(id)
        if (selectedChapterId.value === id) selectedChapterId.value = 'all'
        if (editingChapterId.value === id) { editingChapterId.value = ''; chapterName.value = '' }
      })
    },
  })
}

function openCardEditor(cardId?: string): void {
  if (!cardId && !chapters.value.length) {
    uni.showToast({ title: '请先添加章节，再添加知识卡', icon: 'none' })
    return
  }
  const parts = [`subjectId=${encodeURIComponent(subjectId.value)}`]
  if (!['all', 'uncategorized'].includes(selectedChapterId.value)) {
    parts.push(`chapterId=${encodeURIComponent(selectedChapterId.value)}`)
  }
  if (cardId) parts.push(`cardId=${encodeURIComponent(cardId)}`)
  uni.navigateTo({ url: `/pages/card-edit/index?${parts.join('&')}` })
}

function openStudy(): void {
  uni.navigateTo({
    url: `/pages/study/index?subjectId=${encodeURIComponent(subjectId.value)}`,
  })
}

function removeCard(id: string): void {
  uni.showModal({
    title: '删除知识卡',
    content: '卡片及其全部复习状态和记录都会删除。',
    confirmColor: '#a3453e',
    success: async ({ confirm }) => {
      if (!confirm) return
      await run(() => cardStore.remove(id, subjectId.value))
    },
  })
}

async function toggleCard(id: string): Promise<void> {
  const card = cardStore.cards.find((item) => item.id === id)
  if (!card) return
  await run(() => cardStore.setSuspended(id, card.status !== 'suspended', subjectId.value))
}

async function restoreCard(id: string): Promise<void> {
  await run(async () => {
    await restoreMasteredCard(id)
    await refresh()
    uni.showToast({ title: '已恢复学习', icon: 'success' })
  })
}

function resetProgress(): void {
  const currentSubject = subject.value
  if (!currentSubject || busy.value) return

  uni.showModal({
    title: '重置学习进度',
    content: `将清除“${currentSubject.name}”的复习进度和作答记录，知识卡与章节会保留。此操作无法撤销。`,
    confirmText: '确认重置',
    confirmColor: '#a3453e',
    success: async ({ confirm }) => {
      if (!confirm) return
      await run(async () => {
        await resetSubjectProgress(currentSubject.id)
        await refresh()
        uni.showToast({ title: '学习进度已重置', icon: 'success' })
      })
    },
  })
}
</script>

<template>
  <view class="page-shell">
    <LoadingState v-if="loading" />
    <LoadErrorState v-else-if="loadError" @retry="refresh" />
    <!-- Keep scroll-view mounted while a cached page is activated and refreshed. -->
    <view v-show="!loading && !loadError">
    <view class="subject-header">
      <view class="subject-heading-copy">
        <text class="subject-title">{{ subject?.name ?? '科目' }}</text>
        <text class="subject-meta">{{ cardStore.cards.length }} 张知识卡 · {{ chapters.length }} 个章节</text>
      </view>
      <view class="subject-header-actions">
        <button class="secondary-button header-action" :disabled="busy" @click="openStudy">脉络学习</button>
        <button class="primary-button header-action" :disabled="busy" @click="openCardEditor()">+ 添加卡片</button>
      </view>
    </view>
    <view class="library-actions">
      <button
        class="text-button reset-progress"
        :disabled="busy"
        @click="resetProgress"
      >重置学习进度</button>
    </view>

    <view class="section-heading">
      <text class="section-title">章节</text>
      <button
        v-if="editingChapterId"
        class="text-button"
        size="mini"
        @click="editingChapterId = ''; chapterName = ''"
      >取消编辑</button>
    </view>
    <view class="inline-form">
      <input
        v-model="chapterName"
        :disabled="busy"
        class="field-input"
        maxlength="40"
        :placeholder="editingChapterId ? '修改章节名称' : '添加章节'"
      />
      <button class="secondary-button" :loading="busy" :disabled="busy || !chapterName.trim()" @click="saveChapter">
        {{ editingChapterId ? '保存' : '添加' }}
      </button>
    </view>

    <scroll-view scroll-x class="chapter-scroll">
      <view class="chapter-list">
        <button
          class="chapter-pill"
          :class="{ active: selectedChapterId === 'all' }"
          @click="selectedChapterId = 'all'"
        >
          全部 · {{ cardStore.cards.length }}
        </button>
        <view
          v-for="chapter in chapters"
          :key="chapter.id"
          class="chapter-item"
          :class="{ active: selectedChapterId === chapter.id }"
          @click="selectedChapterId = chapter.id"
        >
          <text class="chapter-name">{{ chapter.name }} · {{ countFor(chapter.id) }}</text>
          <view class="chapter-actions">
            <text @click.stop="beginChapterEdit(chapter.id)">编辑</text>
            <text class="remove" @click.stop="removeChapter(chapter.id)">删除</text>
          </view>
        </view>
        <button
          v-if="countFor()"
          class="chapter-pill"
          :class="{ active: selectedChapterId === 'uncategorized' }"
          @click="selectedChapterId = 'uncategorized'"
        >
          未分类 · {{ countFor() }}
        </button>
      </view>
    </scroll-view>

    <view class="search-row">
      <text class="search-symbol">⌕</text>
      <input
        v-model="searchQuery"
        class="field-input search-input"
        maxlength="100"
        placeholder="搜索问题、答案、小节或标签"
      />
      <button v-if="searchQuery" class="text-button clear-search" aria-label="清除搜索" @click="searchQuery = ''">清除</button>
    </view>

    <view class="status-filters">
      <button v-for="option in statusOptions" :key="option.value" class="status-filter" :class="{ active: statusFilter === option.value }" :aria-pressed="statusFilter === option.value" @click="statusFilter = option.value">{{ option.label }}</button>
    </view>

    <view class="section-heading">
      <text class="section-title">
        {{ selectedChapterName }}
      </text>
      <text class="muted">{{ filteredCards.length }} 张</text>
    </view>

    <EmptyState
      v-if="!cardStore.loading && !filteredCards.length"
      :title="searchQuery || statusFilter !== 'all' ? '没有符合条件的知识卡' : '这里还没有知识卡'"
      :description="searchQuery || statusFilter !== 'all' ? '尝试其他关键词或学习状态。' : '添加一张问答卡，稍后它会进入今日复习。'"
    >
      <button v-if="searchQuery || statusFilter !== 'all'" class="secondary-button empty-action" @click="searchQuery = ''; statusFilter = 'all'">清除筛选</button>
      <button v-else class="secondary-button empty-action" @click="openCardEditor()">添加知识卡</button>
    </EmptyState>
    <KnowledgeCardItem
      v-for="card in displayedCards"
      :key="card.id"
      :card="card"
      :mastered="masteredCardIds.has(card.id)"
      :busy="busy"
      @edit="openCardEditor(card.id)"
      @toggle="toggleCard(card.id)"
      @restore="restoreCard(card.id)"
      @remove="removeCard(card.id)"
    />
    <button v-if="hasMoreCards" class="secondary-button load-more" @click="displayLimit += 20">
      再显示 {{ Math.min(20, filteredCards.length - displayedCards.length) }} 张 · 剩余 {{ filteredCards.length - displayedCards.length }} 张
    </button>
    </view>
  </view>
</template>

<style scoped>
.status-filters {
  display: flex;
  gap: 10rpx;
  margin-top: 20rpx;
}
.status-filter {
  flex: 1;
  padding: 18rpx 8rpx;
  background: transparent;
  color: var(--color-muted);
  font-size: 23rpx;
}
.status-filter.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}
.subject-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin: 10rpx 2rpx 24rpx;
}

.subject-heading-copy {
  min-width: 0;
  flex: 1;
}

.subject-title,
.subject-meta {
  display: block;
}

.subject-title {
  overflow-wrap: anywhere;
  color: var(--color-text);
  font-size: 43rpx;
  font-weight: 820;
  line-height: 1.35;
}

.subject-meta {
  margin-top: 10rpx;
  color: var(--color-muted);
  font-size: 23rpx;
}

.subject-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 12rpx;
}

.header-action {
  padding: 22rpx 24rpx;
  font-size: 24rpx;
}

.library-actions {
  display: flex;
  justify-content: flex-end;
  margin: -10rpx 2rpx 8rpx;
}

.reset-progress {
  color: var(--color-danger);
  font-size: 21rpx;
  opacity: 0.78;
}

.chapter-scroll {
  width: 100%;
  margin-top: 18rpx;
  scrollbar-width: none;
  white-space: nowrap;
}

.chapter-scroll::-webkit-scrollbar {
  display: none;
}

.search-row {
  display: flex;
  position: relative;
  align-items: center;
  margin-top: 18rpx;
}

.search-symbol {
  position: absolute;
  z-index: 1;
  left: 24rpx;
  color: var(--color-muted);
  font-size: 30rpx;
}

.search-input {
  padding-right: 92rpx;
  padding-left: 66rpx;
  background: var(--color-surface);
}

.clear-search {
  position: absolute;
  z-index: 1;
  right: 22rpx;
  color: var(--color-primary);
  font-size: 22rpx;
}

.chapter-list {
  display: flex;
  width: max-content;
  gap: 14rpx;
  padding: 2rpx 2rpx 12rpx;
}

.chapter-pill,
.chapter-item {
  display: inline-flex;
  height: 90rpx;
  padding: 18rpx 22rpx;
  flex: 0 0 auto;
  align-items: center;
  border: 1rpx solid var(--color-line);
  border-radius: 18rpx;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 24rpx;
}

.chapter-pill.active,
.chapter-item.active {
  border-color: #9db9ab;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.chapter-item {
  height: auto;
  max-width: 430rpx;
  flex-direction: column;
  align-items: flex-start;
  white-space: normal;
}

.chapter-name {
  font-weight: 680;
}

.chapter-actions {
  display: flex;
  gap: 22rpx;
  margin-top: 10rpx;
  color: var(--color-primary);
  font-size: 20rpx;
}

.remove {
  color: var(--color-danger);
}

.empty-action {
  margin-top: 28rpx;
}

.load-more {
  width: 100%;
  margin-top: 12rpx;
}

@media (max-width: 430px) {
  .subject-header {
    flex-direction: column;
  }

  .subject-header-actions,
  .header-action {
    width: 100%;
  }

  .subject-header-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
