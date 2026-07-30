<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createCard, getCards, updateCard } from '@/services/cardService'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { CardImportance } from '@/types/card'
import type { Chapter, Subject } from '@/types/subject'

const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const cardId = ref('')
const subjectId = ref('')
const chapterId = ref('')
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
const importanceLabels = ['一般', '重要', '非常重要']
const pageTitle = computed(() => (cardId.value ? '编辑知识卡' : '添加知识卡'))

onLoad(async (query) => {
  try {
    cardId.value = String(query?.cardId ?? '')
    subjectId.value = String(query?.subjectId ?? '')
    chapterId.value = String(query?.chapterId ?? '')
    ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
    if (!subjectId.value && subjects.value.length) subjectId.value = subjects.value[0].id
    if (cardId.value) {
      const card = (await getCards()).find((item) => item.id === cardId.value)
      if (card) {
        subjectId.value = card.subjectId
        chapterId.value = card.chapterId ?? ''
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

.notice {
  padding: 24rpx;
  margin-bottom: 22rpx;
  border-left: 5rpx solid var(--color-accent);
  color: #8f5b2e;
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
