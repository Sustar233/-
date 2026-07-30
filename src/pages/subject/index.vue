<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import KnowledgeCardItem from '@/components/KnowledgeCard.vue'
import { useCardStore } from '@/stores/card'
import { useSubjectStore } from '@/stores/subject'

const subjectStore = useSubjectStore()
const cardStore = useCardStore()
const subjectId = ref('')
const selectedChapterId = ref<string | undefined>(undefined)
const chapterName = ref('')
const editingChapterId = ref('')

const subject = computed(() => subjectStore.subjects.find((item) => item.id === subjectId.value))
const chapters = computed(() =>
  subjectStore.chapters.filter((chapter) => chapter.subjectId === subjectId.value),
)
const visibleCards = computed(() =>
  cardStore.cards.filter((card) => card.chapterId === selectedChapterId.value),
)

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
      if (selectedChapterId.value === id) selectedChapterId.value = undefined
      await refresh()
    },
  })
}

function openCardEditor(cardId?: string): void {
  const parts = [`subjectId=${encodeURIComponent(subjectId.value)}`]
  if (selectedChapterId.value) parts.push(`chapterId=${encodeURIComponent(selectedChapterId.value)}`)
  if (cardId) parts.push(`cardId=${encodeURIComponent(cardId)}`)
  uni.navigateTo({ url: `/pages/card-edit/index?${parts.join('&')}` })
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
      <view>
        <text class="subject-title">{{ subject?.name ?? '科目' }}</text>
        <text class="subject-meta">{{ cardStore.cards.length }} 张知识卡 · {{ chapters.length }} 个章节</text>
      </view>
      <button class="primary-button add-card" @click="openCardEditor()">+ 添加知识卡</button>
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
          :class="{ active: selectedChapterId === undefined }"
          @click="selectedChapterId = undefined"
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

    <view class="section-heading">
      <text class="section-title">
        {{ selectedChapterId ? chapters.find((item) => item.id === selectedChapterId)?.name : '未分类' }}
      </text>
      <text class="muted">{{ visibleCards.length }} 张</text>
    </view>

    <EmptyState
      v-if="!cardStore.loading && !visibleCards.length"
      title="这里还没有知识卡"
      description="添加一张问答卡，稍后它会进入今日复习。"
    >
      <button class="secondary-button empty-action" @click="openCardEditor()">添加知识卡</button>
    </EmptyState>
    <KnowledgeCardItem
      v-for="card in visibleCards"
      :key="card.id"
      :card="card"
      @edit="openCardEditor(card.id)"
      @toggle="toggleCard(card.id)"
      @remove="removeCard(card.id)"
    />
  </view>
</template>

<style scoped>
.subject-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin: 10rpx 2rpx 18rpx;
}

.subject-title,
.subject-meta {
  display: block;
}

.subject-title {
  font-size: 43rpx;
  font-weight: 800;
}

.subject-meta {
  margin-top: 10rpx;
  color: #7c8780;
  font-size: 23rpx;
}

.add-card {
  padding: 22rpx 24rpx;
  flex: 0 0 auto;
  font-size: 24rpx;
}

.chapter-scroll {
  width: 100%;
  margin-top: 18rpx;
  white-space: nowrap;
}

.chapter-list {
  display: flex;
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
  border: 1rpx solid #dfe5df;
  border-radius: 18rpx;
  background: #ffffff;
  color: #526058;
  font-size: 24rpx;
}

.chapter-pill.active,
.chapter-item.active {
  border-color: #7da08f;
  background: #e8f0ec;
  color: #245b47;
}

.chapter-item {
  height: auto;
  flex-direction: column;
  align-items: flex-start;
}

.chapter-name {
  font-weight: 680;
}

.chapter-actions {
  display: flex;
  gap: 22rpx;
  margin-top: 10rpx;
  color: #668074;
  font-size: 20rpx;
}

.remove {
  color: #a9443d;
}

.empty-action {
  margin-top: 28rpx;
}
</style>
