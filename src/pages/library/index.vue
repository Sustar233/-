<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SubjectCard from '@/components/SubjectCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { getCards } from '@/services/cardService'
import { useSubjectStore } from '@/stores/subject'

const subjectStore = useSubjectStore()
const cardCounts = ref<Record<string, number>>({})
const name = ref('')
const description = ref('')
const editingId = ref('')
const { running: saving, run } = useAsyncAction()
const loadError = ref(false)
const loading = ref(true)
const editorOpen = ref(false)

const formTitle = computed(() => (editingId.value ? '编辑科目' : '新建科目'))

async function refresh(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const [, cards] = await Promise.all([subjectStore.load(), getCards()])
    cardCounts.value = cards.reduce<Record<string, number>>((counts, card) => {
      counts[card.subjectId] = (counts[card.subjectId] ?? 0) + 1
      return counts
    }, {})
    if (!subjectStore.subjects.length) editorOpen.value = true
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onShow(refresh)

function resetForm(): void {
  editingId.value = ''
  name.value = ''
  description.value = ''
  editorOpen.value = false
}

async function submit(): Promise<void> {
  await run(async () => {
    if (editingId.value) {
      await subjectStore.editSubject(editingId.value, name.value, description.value)
    } else {
      await subjectStore.addSubject(name.value, description.value)
    }
    resetForm()
    uni.showToast({ title: '已保存', icon: 'success' })
  })
}

function editSubject(id: string): void {
  const subject = subjectStore.subjects.find((item) => item.id === id)
  if (!subject) return
  editorOpen.value = true
  editingId.value = subject.id
  name.value = subject.name
  description.value = subject.description ?? ''
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}

function removeSubject(id: string): void {
  const subject = subjectStore.subjects.find((item) => item.id === id)
  if (!subject) return
  uni.showModal({
    title: '删除科目',
    content: `“${subject.name}”下的章节、卡片和复习记录都会删除，确定继续吗？`,
    confirmColor: '#a3453e',
    success: async ({ confirm }) => {
      if (!confirm) return
      await run(async () => {
        await subjectStore.removeSubject(id)
        if (editingId.value === id) resetForm()
        if (!subjectStore.subjects.length) editorOpen.value = true
        uni.showToast({ title: '科目已删除', icon: 'success' })
      })
    },
  })
}

function openSubject(id: string): void {
  uni.navigateTo({ url: `/pages/subject/index?id=${encodeURIComponent(id)}` })
}
</script>

<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <text class="eyebrow">知识归档</text>
        <text class="page-title">知识库</text>
      </view>
      <button class="secondary-button create-subject" :disabled="saving || loading || loadError" :aria-expanded="editorOpen" @click="editorOpen ? resetForm() : editorOpen = true">{{ editorOpen ? '收起表单' : '+ 新建科目' }}</button>
    </view>

    <LoadingState v-if="loading" />
    <LoadErrorState v-else-if="loadError" @retry="refresh" />

    <template v-else>
    <view v-if="editorOpen" class="editor surface">
      <view class="editor-heading">
        <text class="editor-title">{{ formTitle }}</text>
        <button v-if="editingId" class="text-button" size="mini" @click="resetForm">取消</button>
      </view>
      <input v-model="name" :disabled="saving" class="field-input" maxlength="40" placeholder="科目名称，例如：操作系统" />
      <input
        v-model="description"
        :disabled="saving"
        class="field-input description-input"
        maxlength="100"
        placeholder="一句话说明（可选）"
      />
      <button class="primary-button submit" :loading="saving" :disabled="saving || !name.trim()" @click="submit">
        {{ editingId ? '保存修改' : '创建科目' }}
      </button>
    </view>

    <view class="section-heading">
      <text class="section-title">全部科目</text>
      <text class="muted">{{ subjectStore.subjects.length }} 个科目 · 点击进入</text>
    </view>

    <EmptyState
      v-if="!subjectStore.loading && !subjectStore.subjects.length"
      title="还没有科目"
      description="先创建一个科目，再添加章节和知识卡。"
    />
    <SubjectCard
      v-for="subject in subjectStore.subjects"
      :key="subject.id"
      :subject="subject"
      :card-count="cardCounts[subject.id] ?? 0"
      :busy="saving"
      @open="openSubject(subject.id)"
      @edit="editSubject(subject.id)"
      @remove="removeSubject(subject.id)"
    />
    </template>
  </view>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 10rpx 2rpx 32rpx;
}

.create-subject {
  padding: 20rpx 24rpx;
  font-size: 24rpx;
}

.editor {
  padding: 30rpx;
}

.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.editor-title {
  font-size: 28rpx;
  font-weight: 750;
}

.description-input {
  margin-top: 14rpx;
}

.submit {
  width: 100%;
  margin-top: 18rpx;
}

@media (max-width: 360px) {
  .page-header {
    align-items: flex-start;
  }
}
</style>
