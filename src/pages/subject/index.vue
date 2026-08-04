<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import KnowledgeCardItem from '@/components/KnowledgeCard.vue'
import { useCardStore } from '@/stores/card'
import { useSubjectStore } from '@/stores/subject'

const subjectStore = useSubjectStore()
const cardStore = useCardStore()
const subjectId = ref('')
const selectedChapterId = ref('all')
const chapterName = ref('')
const editingChapterId = ref('')
const searchQuery = ref('')
const displayLimit = ref(20)

const subject = computed(() => subjectStore.subjects.find((item) => item.id === subjectId.value))
const chapters = computed(() =>
  subjectStore.chapters.filter((chapter) => chapter.subjectId === subjectId.value),
)
const visibleCards = computed(() => {
  if (selectedChapterId.value === 'all') return cardStore.cards
  if (selectedChapterId.value === 'uncategorized') {
    return cardStore.cards.filter((card) => !card.chapterId)
  }
  return cardStore.cards.filter((card) => card.chapterId === selectedChapterId.value)
})
const selectedChapterName = computed(() => {
  if (selectedChapterId.value === 'all') return '全部知识卡'
  if (selectedChapterId.value === 'uncategorized') return '未分类'
  return chapters.value.find((item) => item.id === selectedChapterId.value)?.name ?? '知识卡'
})
const filteredCards = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return visibleCards.value
  return visibleCards.value.filter((card) =>
    [card.question, card.answer, card.note ?? '', ...card.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})
const displayedCards = computed(() => filteredCards.value.slice(0, displayLimit.value))
const hasMoreCards = computed(() => displayedCards.value.length < filteredCards.value.length)

watch([selectedChapterId, searchQuery], () => {
  displayLimit.value = 20
})

onLoad((query) => {
  subjectId.value = String(query?.id ?? '')
})

onShow(refresh)

async function refresh(): Promise<void> {
  if (!subjectId.value) return
  await Promise.all([subjectStore.load(), cardStore.load(subjectId.value)])
  if (subject.value) uni.setNavigationBarTitle({ title: subject.value.name })
}

function countFor(chapterId?: string): number {
  return cardStore.cards.filter((card) => card.chapterId === chapterId).length
}

async function saveChapter(): Promise<void> {
  try {
    if (editingChapterId.value) {
      await subjectStore.editChapter(editingChapterId.value, chapterName.value)
    } else {
      await subjectStore.addChapter(subjectId.value, chapterName.value)
    }
    chapterName.value = ''
    editingChapterId.value = ''
    await refresh()
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  }
}

function beginChapterEdit(id: string): void {
  const chapter = chapters.value.find((item) => item.id === id)
  if (!chapter) return
  editingChapterId.value = id
  chapterName.value = chapter.name
}

function removeChapter(id: string): void {
  const chapter = chapters.value.find((item) => item.id === id)
  if (!chapter) return
  uni.showModal({
    title: '删除章节',
    content: `删除“${chapter.name}”后，其中的卡片会移到未分类。`,
    confirmColor: '#a9443d',
    success: async ({ confirm }) => {
      if (!confirm) return
      await subjectStore.removeChapter(id)
      if (selectedChapterId.value === id) selectedChapterId.value = 'all'
      await refresh()
    },
  })
}

function openCardEditor(cardId?: string): void {
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
    confirmColor: '#a9443d',
    success: async ({ confirm }) => {
      if (!confirm) return
      await cardStore.remove(id, subjectId.value)
    },
  })
}

async function toggleCard(id: string): Promise<void> {
  const card = cardStore.cards.find((item) => item.id === id)
  if (!card) return
  await cardStore.setSuspended(id, card.status !== 'suspended', subjectId.value)
}
</script>

<template>
  <view class="page-shell">
    <view class="subject-header">
      <view class="subject-heading-copy">
        <text class="subject-title">{{ subject?.name ?? '科目' }}</text>
        <text class="subject-meta">{{ cardStore.cards.length }} 张知识卡 · {{ chapters.length }} 个章节</text>
      </view>
      <view class="subject-header-actions">
        <button class="secondary-button header-action" @click="openStudy">专项复习</button>
        <button class="primary-button header-action" @click="openCardEditor()">+ 添加卡片</button>
      </view>
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
        class="field-input"
        maxlength="40"
        :placeholder="editingChapterId ? '修改章节名称' : '添加章节'"
      />
      <button class="secondary-button" @click="saveChapter">
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
        <button
          class="chapter-pill"
          :class="{ active: selectedChapterId === 'uncategorized' }"
          @click="selectedChapterId = 'uncategorized'"
        >
          未分类 · {{ countFor() }}
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
      </view>
    </scroll-view>

    <view class="search-row">
      <text class="search-symbol">⌕</text>
      <input
        v-model="searchQuery"
        class="field-input search-input"
        maxlength="100"
        placeholder="搜索问题、答案或标签"
      />
      <text v-if="searchQuery" class="clear-search" @click="searchQuery = ''">清除</text>
    </view>

    <view class="section-heading">
      <text class="section-title">
        {{ selectedChapterName }}
      </text>
      <text class="muted">{{ filteredCards.length }} 张</text>
    </view>

    <EmptyState
      v-if="!cardStore.loading && !filteredCards.length"
      :title="searchQuery ? '没有找到相关知识卡' : '这里还没有知识卡'"
      :description="searchQuery ? '换一个关键词，或清除搜索后再试。' : '添加一张问答卡，稍后它会进入今日复习。'"
    >
      <button v-if="!searchQuery" class="secondary-button empty-action" @click="openCardEditor()">添加知识卡</button>
    </EmptyState>
    <KnowledgeCardItem
      v-for="card in displayedCards"
      :key="card.id"
      :card="card"
      @edit="openCardEditor(card.id)"
      @toggle="toggleCard(card.id)"
      @remove="removeCard(card.id)"
    />
    <button v-if="hasMoreCards" class="secondary-button load-more" @click="displayLimit += 20">
      再显示 20 张
    </button>
  </view>
</template>

<style scoped>
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
  border: 1rpx solid #ddd5c8;
  border-radius: 18rpx;
  background: var(--color-surface);
  color: #545d55;
  font-size: 24rpx;
}

.chapter-pill.active,
.chapter-item.active {
  border-color: #82a694;
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
  color: #557566;
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
