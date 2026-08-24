<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SubjectCard from '@/components/SubjectCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import { getCards } from '@/services/cardService'
import { useSubjectStore } from '@/stores/subject'

const subjectStore = useSubjectStore()
const cardCounts = ref<Record<string, number>>({})
const name = ref('')
const description = ref('')
const editingId = ref('')
const saving = ref(false)
const loadError = ref(false)

const formTitle = computed(() => (editingId.value ? '编辑科目' : '新建科目'))

async function refresh(): Promise<void> {
  loadError.value = false
  try {
    await subjectStore.load()
    const cards = await getCards()
    cardCounts.value = cards.reduce<Record<string, number>>((counts, card) => {
      counts[card.subjectId] = (counts[card.subjectId] ?? 0) + 1
      return counts
    }, {})
  } catch {
    loadError.value = true
  }
}

onShow(refresh)

function resetForm(): void {
  editingId.value = ''
  name.value = ''
  description.value = ''
}

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    if (editingId.value) {
      await subjectStore.editSubject(editingId.value, name.value, description.value)
    } else {
      await subjectStore.addSubject(name.value, description.value)
    }
    resetForm()
    await refresh()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    saving.value = false
  }
}

function editSubject(id: string): void {
  const subject = subjectStore.subjects.find((item) => item.id === id)
  if (!subject) return
  editingId.value = subject.id
  name.value = subject.name
  description.value = subject.description ?? ''
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
      await subjectStore.removeSubject(id)
      if (editingId.value === id) resetForm()
      await refresh()
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
      <text class="subject-total">{{ subjectStore.subjects.length }} 个科目</text>
    </view>

    <LoadErrorState v-if="loadError" @retry="refresh" />

    <template v-else>
    <view class="editor surface">
      <view class="editor-heading">
        <text class="editor-title">{{ formTitle }}</text>
        <button v-if="editingId" class="text-button" size="mini" @click="resetForm">取消</button>
      </view>
      <input v-model="name" class="field-input" maxlength="40" placeholder="科目名称，例如：操作系统" />
      <input
        v-model="description"
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
      <text class="muted">点击进入</text>
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

.subject-total {
  margin-bottom: 5rpx;
  color: var(--color-muted);
  font-size: 22rpx;
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
