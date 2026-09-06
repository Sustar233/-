<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import LoadingState from '@/components/LoadingState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
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
const { running: saving, run } = useAsyncAction()
const loading = ref(true)
const loadError = ref(false)
const saved = ref(false)
let returnTimer: ReturnType<typeof setTimeout> | undefined

const subjectNames = computed(() => subjects.value.map((subject) => subject.name))
const availableChapters = computed(() =>
  chapters.value.filter((chapter) => chapter.subjectId === subjectId.value),
)
const chapterNames = computed(() => availableChapters.value.map((chapter) => chapter.name))
const subjectIndex = computed(() => Math.max(0, subjects.value.findIndex((item) => item.id === subjectId.value)))
const chapterIndex = computed(() => Math.max(0, availableChapters.value.findIndex((item) => item.id === chapterId.value)))
const selectedSubjectName = computed(
  () => subjects.value.find((subject) => subject.id === subjectId.value)?.name ?? '请选择科目',
)
const selectedChapterName = computed(
  () => availableChapters.value.find((chapter) => chapter.id === chapterId.value)?.name ?? '请选择章节',
)
const parentCandidates = computed(() =>
  cards.value
    .filter((card) => card.subjectId === subjectId.value && card.id !== cardId.value)
    .sort((first, second) => first.createdAt - second.createdAt),
)
const chapterNamesById = computed(() => new Map(chapters.value.map((chapter) => [chapter.id, chapter.name])))
const parentIndex = computed(() => parentCandidates.value.findIndex((card) => card.id === parentCardId.value) + 1)
const parentOptions = computed(() => [
  '无（作为知识起点）',
  ...parentCandidates.value.map((card) => {
    const chapter = chapterNamesById.value.get(card.chapterId ?? '') ?? '未分类'
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

async function load(): Promise<void> {
  if (saving.value) return
  loading.value = true
  loadError.value = false
  try {
    ;[subjects.value, chapters.value, cards.value] = await Promise.all([
      getSubjects(),
      getChapters(),
      getCards(),
    ])
    if (!subjectId.value && subjects.value.length) subjectId.value = subjects.value[0].id
    if (cardId.value) {
      const card = cards.value.find((item) => item.id === cardId.value)
      if (!card) throw new Error('知识卡不存在')
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
    if (!cardId.value && !availableChapters.value.some((chapter) => chapter.id === chapterId.value)) {
      chapterId.value = availableChapters.value[0]?.id ?? ''
    }
    uni.setNavigationBarTitle({ title: pageTitle.value })
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  cardId.value = String(query?.cardId ?? '')
  subjectId.value = String(query?.subjectId ?? '')
  chapterId.value = String(query?.chapterId ?? '')
  void load()
})
onUnload(() => clearTimeout(returnTimer))

function changeSubject(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  const nextSubjectId = subjects.value[index]?.id ?? ''
  if (nextSubjectId === subjectId.value) return
  subjectId.value = nextSubjectId
  chapterId.value = chapters.value.find((chapter) => chapter.subjectId === subjectId.value)?.id ?? ''
  parentCardId.value = ''
  connection.value = ''
}

function changeParent(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  const nextParentId = index === 0 ? '' : parentCandidates.value[index - 1]?.id ?? ''
  if (nextParentId === parentCardId.value) return
  parentCardId.value = nextParentId
  connection.value = ''
}

function changeChapter(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  chapterId.value = availableChapters.value[index]?.id ?? ''
}

function changeImportance(event: { detail: { value: string | number } }): void {
  importance.value = (Number(event.detail.value) + 1) as CardImportance
}

async function save(): Promise<void> {
  if (saving.value || saved.value || loading.value || loadError.value) return
  if (!subjectId.value) {
    uni.showToast({ title: '请先创建并选择科目', icon: 'none' })
    return
  }
  if (!chapterId.value) {
    uni.showToast({ title: '请先为知识卡选择章节', icon: 'none' })
    return
  }
  await run(async () => {
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
    saved.value = true
    uni.showToast({ title: '已保存', icon: 'success' })
    returnTimer = setTimeout(() => uni.navigateBack(), 350)
  })
}
</script>

<template>
  <view class="page-shell form-page">
    <view class="page-heading">
      <text class="eyebrow">主动回忆</text>
      <text class="page-title">{{ pageTitle }}</text>
      <text class="page-subtitle">用清晰的问题和简洁的答案，留下真正值得记住的内容。</text>
    </view>

    <LoadingState v-if="loading" />
    <LoadErrorState v-else-if="loadError" description="知识卡可能已删除，或数据暂时无法读取。请重试或返回知识库。" @retry="load" />
    <template v-else>
    <view v-if="!subjects.length" class="notice surface">
      请先到知识库创建科目，再添加知识卡。
    </view>

    <view class="form-card surface">
      <text class="field-label first-label">科目</text>
      <picker :range="subjectNames" :value="subjectIndex" :disabled="saving || saved" @change="changeSubject">
        <view class="picker-field">{{ selectedSubjectName }}</view>
      </picker>

      <text class="field-label">章节</text>
      <picker :range="chapterNames" :value="chapterIndex" :disabled="!chapterNames.length || saving || saved" @change="changeChapter">
        <view class="picker-field">{{ selectedChapterName }}</view>
      </picker>
      <text v-if="subjectId && !availableChapters.length" class="field-help chapter-help">
        当前知识库还没有章节，请返回知识库先添加章节。
      </text>

      <view class="path-heading">
        <text class="field-label">前置知识</text>
        <text class="path-badge">知识路径</text>
      </view>
      <picker :range="parentOptions" :value="parentIndex" :disabled="saving || saved" @change="changeParent">
        <view class="picker-field path-picker">{{ selectedParentName }}</view>
      </picker>
      <text class="field-help">复习时会先呈现前置知识，再学习当前内容；不选择时按章节录入顺序衔接。</text>
      <text class="field-label">知识连接说明</text>
      <input v-model="connection" class="field-input" maxlength="1000" placeholder="与前置知识的关系（可选）" />

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
        placeholder="来源或页码（可选）"
      />

      <button class="primary-button save-button" :loading="saving" :disabled="saving || saved || !chapterId || !question.trim() || !answer.trim()" @click="save">{{ saved ? '已保存' : '保存知识卡' }}</button>
    </view>
    </template>
  </view>
</template>

<style scoped>
.form-page {
  padding-bottom: 90rpx;
}

.form-card {
  padding: 30rpx;
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
  border: 1rpx solid #d0dfd7;
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

.chapter-help {
  color: var(--color-danger);
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

.note-input {
  min-height: 150rpx;
}

.save-button {
  width: 100%;
  margin-top: 44rpx;
}
</style>
