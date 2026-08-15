<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createCard, getCards, updateCard } from '@/services/cardService'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { CardImportance, KnowledgeCard } from '@/types/card'
import type { Chapter, Subject } from '@/types/subject'

const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const cards = ref<KnowledgeCard[]>([])
const cardId = ref('')
const subjectId = ref('')
const chapterId = ref('')
const parentCardId = ref('')
const connection = ref('')
const question = ref('')
const answer = ref('')
const tags = ref('')
const importance = ref<CardImportance>(2)
const note = ref('')
const saving = ref(false)
const loading = ref(true)

const subjectNames = computed(() => subjects.value.map((subject) => subject.name))
const availableChapters = computed(() =>
  chapters.value.filter((chapter) => chapter.subjectId === subjectId.value),
)
const chapterNames = computed(() => ['未分类', ...availableChapters.value.map((chapter) => chapter.name)])
const selectedSubjectName = computed(
  () => subjects.value.find((subject) => subject.id === subjectId.value)?.name ?? '请选择科目',
)
const selectedChapterName = computed(
  () => availableChapters.value.find((chapter) => chapter.id === chapterId.value)?.name ?? '未分类',
)
const parentCandidates = computed(() =>
  cards.value
    .filter((card) => card.subjectId === subjectId.value && card.id !== cardId.value)
    .sort((first, second) => first.createdAt - second.createdAt),
)
const parentOptions = computed(() => [
  '无（作为知识起点）',
  ...parentCandidates.value.map((card) => {
    const chapter = chapters.value.find((item) => item.id === card.chapterId)?.name ?? '未分类'
    const title = card.question.length > 28 ? `${card.question.slice(0, 28)}…` : card.question
    return `${chapter}｜${title}`
  }),
])
const selectedParentName = computed(() => {
  if (!parentCardId.value) return parentOptions.value[0]
  const index = parentCandidates.value.findIndex((card) => card.id === parentCardId.value)
  return index < 0 ? '前置知识已不可用' : parentOptions.value[index + 1]
})
const importanceLabels = ['一般', '重要', '非常重要']
const pageTitle = computed(() => (cardId.value ? '编辑知识卡' : '添加知识卡'))

onLoad(async (query) => {
  try {
    cardId.value = String(query?.cardId ?? '')
    subjectId.value = String(query?.subjectId ?? '')
    chapterId.value = String(query?.chapterId ?? '')
    ;[subjects.value, chapters.value, cards.value] = await Promise.all([
      getSubjects(),
      getChapters(),
      getCards(),
    ])
    if (!subjectId.value && subjects.value.length) subjectId.value = subjects.value[0].id
    if (cardId.value) {
      const card = cards.value.find((item) => item.id === cardId.value)
      if (card) {
        subjectId.value = card.subjectId
        chapterId.value = card.chapterId ?? ''
        parentCardId.value = card.parentCardId ?? ''
        connection.value = card.connection ?? ''
        question.value = card.question
        answer.value = card.answer
        tags.value = card.tags.join(', ')
        importance.value = card.importance
        note.value = card.note ?? ''
      }
    }
    uni.setNavigationBarTitle({ title: pageTitle.value })
  } finally {
    loading.value = false
  }
})

function changeSubject(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  subjectId.value = subjects.value[index]?.id ?? ''
  chapterId.value = ''
  parentCardId.value = ''
}

function changeParent(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  parentCardId.value = index === 0 ? '' : parentCandidates.value[index - 1]?.id ?? ''
}

function changeChapter(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  chapterId.value = index === 0 ? '' : availableChapters.value[index - 1]?.id ?? ''
}

function changeImportance(event: { detail: { value: string | number } }): void {
  importance.value = (Number(event.detail.value) + 1) as CardImportance
}

async function save(): Promise<void> {
  if (saving.value) return
  if (!subjectId.value) {
    uni.showToast({ title: '请先创建并选择科目', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const input = {
      subjectId: subjectId.value,
      chapterId: chapterId.value || undefined,
      parentCardId: parentCardId.value || undefined,
      connection: connection.value,
      question: question.value,
      answer: answer.value,
      tags: tags.value.split(/[,，]/),
      importance: importance.value,
      note: note.value,
    }
    if (cardId.value) await updateCard(cardId.value, input)
    else await createCard(input)
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 350)
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page-shell form-page">
    <view class="page-heading">
      <text class="eyebrow">主动回忆</text>
      <text class="page-title">{{ pageTitle }}</text>
      <text class="page-subtitle">用清晰的问题和简洁的答案，留下真正值得记住的内容。</text>
    </view>

    <view v-if="!loading && !subjects.length" class="notice surface">
      请先到知识库创建科目，再添加知识卡。
    </view>

    <view class="form-card surface">
      <text class="field-label first-label">科目</text>
      <picker :range="subjectNames" @change="changeSubject">
        <view class="picker-field">{{ selectedSubjectName }}</view>
      </picker>

      <text class="field-label">章节</text>
      <picker :range="chapterNames" @change="changeChapter">
        <view class="picker-field">{{ selectedChapterName }}</view>
      </picker>

      <view class="path-heading">
        <text class="field-label">前置知识</text>
        <text class="path-badge">知识路径</text>
      </view>
      <picker :range="parentOptions" @change="changeParent">
        <view class="picker-field path-picker">{{ selectedParentName }}</view>
      </picker>
      <text class="field-help">复习时会先呈现前置知识，再学习当前内容；不选择时按章节录入顺序衔接。</text>

      <text class="field-label">关联说明</text>
      <textarea
        v-model="connection"
        class="field-textarea connection-input"
        maxlength="500"
        placeholder="例如：由定义推导应用，或说明它与前置知识的关系"
      />

      <view class="form-divider" />

      <text class="field-label required">问题</text>
      <textarea
        v-model="question"
        class="field-textarea question-input"
        maxlength="1000"
        placeholder="输入需要主动回忆的问题"
      />

      <text class="field-label required">答案</text>
      <textarea
        v-model="answer"
        class="field-textarea answer-input"
        maxlength="5000"
        placeholder="输入标准答案"
      />

      <text class="field-label">标签</text>
      <input v-model="tags" class="field-input" maxlength="200" placeholder="用逗号分隔，例如：概念, 重点" />

      <text class="field-label">重要程度</text>
      <picker :range="importanceLabels" :value="importance - 1" @change="changeImportance">
        <view class="picker-field">{{ importanceLabels[importance - 1] }}</view>
      </picker>

      <text class="field-label">备注</text>
      <textarea
        v-model="note"
        class="field-textarea note-input"
        maxlength="2000"
        placeholder="补充说明（可选）"
      />

      <button class="primary-button save-button" :loading="saving" :disabled="saving || loading" @click="save">保存知识卡</button>
    </view>
  </view>
</template>

<style scoped>
.form-page {
  padding-bottom: 90rpx;
}

.form-card {
  padding: 30rpx;
  border-top: 5rpx solid var(--color-primary);
}

.first-label {
  margin-top: 0;
}

.form-divider {
  width: 100%;
  height: 1rpx;
  margin: 34rpx 0 4rpx;
  background: var(--color-line);
}

.path-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.path-badge {
  margin-top: 26rpx;
  padding: 6rpx 12rpx;
  border: 1rpx solid rgba(103, 216, 197, 0.32);
  border-radius: 999rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 19rpx;
}

.path-picker {
  line-height: 1.55;
}

.field-help {
  display: block;
  margin-top: 10rpx;
  color: var(--color-subtle);
  font-size: 21rpx;
  line-height: 1.55;
}

.notice {
  padding: 24rpx;
  margin-bottom: 22rpx;
  border-left: 5rpx solid var(--color-accent);
  color: var(--color-accent);
  line-height: 1.6;
}

.required::after {
  margin-left: 6rpx;
  color: var(--color-danger);
  content: '*';
}

.question-input {
  min-height: 170rpx;
}

.answer-input {
  min-height: 300rpx;
}

.connection-input {
  min-height: 140rpx;
}

.note-input {
  min-height: 150rpx;
}

.save-button {
  width: 100%;
  margin-top: 44rpx;
}
</style>
