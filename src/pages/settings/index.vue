<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  exportBackup,
  hasAutomaticBackup,
  importBackup,
  parseBackup,
  restoreAutomaticBackup as restoreAutomaticBackupData,
} from '@/services/backupService'
import { restorePresetKnowledge } from '@/services/presetKnowledgeService'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const dailyNewCards = ref('20')
const backupText = ref('')
const working = ref(false)
const automaticBackupAvailable = ref(false)

onShow(async () => {
  await settingsStore.load()
  dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
  automaticBackupAvailable.value = await hasAutomaticBackup()
})

async function saveDailyLimit(): Promise<void> {
  await settingsStore.setDailyNewCards(Number(dailyNewCards.value) || 0)
  dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
  uni.showToast({ title: '已保存', icon: 'success' })
}

async function exportData(): Promise<void> {
  working.value = true
  try {
    backupText.value = await exportBackup()
    uni.setClipboardData({
      data: backupText.value,
      success: () => uni.showToast({ title: '备份已复制', icon: 'success' }),
    })
  } finally {
    working.value = false
  }
}

function importData(): void {
  try {
    parseBackup(backupText.value)
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none', duration: 2600 })
    return
  }

  uni.showModal({
    title: '覆盖当前数据',
    content: '导入会覆盖当前全部科目、卡片和复习记录。系统会先自动保存当前数据。',
    confirmColor: '#a3453e',
    success: async ({ confirm }) => {
      if (!confirm) return
      working.value = true
      try {
        await importBackup(backupText.value)
        await settingsStore.load()
        dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
        automaticBackupAvailable.value = true
        uni.showToast({ title: '导入成功', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error as Error).message, icon: 'none' })
      } finally {
        working.value = false
      }
    },
  })
}

function restoreAutomaticBackup(): void {
  uni.showModal({
    title: '恢复导入前备份',
    content: '将恢复最近一次导入前的数据，当前数据也会自动保留为新的恢复点。',
    confirmColor: '#28624f',
    success: async ({ confirm }) => {
      if (!confirm) return
      working.value = true
      try {
        await restoreAutomaticBackupData()
        await settingsStore.load()
        dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
        uni.showToast({ title: '已恢复备份', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error as Error).message, icon: 'none' })
      } finally {
        working.value = false
      }
    },
  })
}

function restoreDefaultKnowledge(): void {
  uni.showModal({
    title: '恢复默认知识库',
    content: '将补齐内置的操作系统知识库，并保留你自行创建的科目和卡片。',
    confirmColor: '#28624f',
    success: async ({ confirm }) => {
      if (!confirm) return
      working.value = true
      try {
        await restorePresetKnowledge()
        uni.showToast({ title: '默认知识库已恢复', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: (error as Error).message, icon: 'none' })
      } finally {
        working.value = false
      }
    },
  })
}
</script>

<template>
  <view class="page-shell">
    <view class="page-heading">
      <text class="eyebrow">偏好与数据</text>
      <text class="page-title">设置</text>
      <text class="page-subtitle">只有真正影响复习的选项。</text>
    </view>

    <view class="section-heading">
      <text class="section-title">复习设置</text>
    </view>
    <view class="setting-card surface">
      <view class="setting-copy">
        <text class="setting-name">每日新卡数量</text>
        <text class="setting-description">到期旧卡不受此限制，并始终优先。</text>
      </view>
      <view class="limit-row">
        <input v-model="dailyNewCards" class="limit-input" type="number" maxlength="3" />
        <text class="limit-unit">张</text>
        <button class="secondary-button save-limit" size="mini" @click="saveDailyLimit">保存</button>
      </view>
    </view>

    <view class="section-heading">
      <text class="section-title">默认知识库</text>
    </view>
    <view class="preset-card surface">
      <view class="setting-copy">
        <text class="setting-name">操作系统知识库</text>
        <text class="setting-description">知识库缺失或不完整时，可以在这里重新补齐。</text>
      </view>
      <button class="secondary-button restore-preset" :disabled="working" @click="restoreDefaultKnowledge">
        恢复默认知识库
      </button>
    </view>

    <view class="section-heading">
      <text class="section-title">数据备份</text>
      <text class="muted">JSON</text>
    </view>
    <view class="backup-card surface">
      <text class="backup-intro">
        导出会把所有数据复制到剪贴板。恢复时请粘贴完整 JSON，校验失败不会修改当前数据。
      </text>
      <textarea
        v-model="backupText"
        class="backup-textarea"
        maxlength="-1"
        placeholder="导出的 JSON 会显示在这里，也可以粘贴备份以恢复数据。"
      />
      <view class="backup-actions">
        <button class="secondary-button" :loading="working" :disabled="working" @click="exportData">导出并复制</button>
        <button class="danger-button" :disabled="working || !backupText.trim()" @click="importData">
          导入并覆盖
        </button>
      </view>
      <button
        v-if="automaticBackupAvailable"
        class="text-button snapshot-action"
        :disabled="working"
        @click="restoreAutomaticBackup"
      >
        恢复最近一次导入前备份
      </button>
    </view>

    <view class="about-card">
      <view class="about-title-row">
        <view class="about-seal">舟</view>
        <text class="about-name">苦作舟 1.0</text>
      </view>
      <text class="about-copy">数据仅保存在当前设备。无账号、无云端、无额外追踪。</text>
    </view>
  </view>
</template>

<style scoped>
.setting-card,
.preset-card,
.backup-card {
  padding: 30rpx;
}

.setting-name,
.setting-description {
  display: block;
}

.setting-name {
  font-size: 29rpx;
  font-weight: 720;
}

.setting-description {
  margin-top: 9rpx;
  color: var(--color-muted);
  font-size: 23rpx;
}

.limit-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 26rpx;
}

.limit-input {
  width: 150rpx;
  height: 76rpx;
  min-height: 76rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-line);
  border-radius: 14rpx;
  background: var(--color-surface-strong);
  color: var(--color-text);
  font-size: 30rpx;
  text-align: center;
}

.limit-unit {
  color: var(--color-muted);
}

.save-limit {
  margin-left: auto;
}

.restore-preset {
  width: 100%;
  margin-top: 24rpx;
}

.backup-intro {
  display: block;
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.7;
}

.backup-textarea {
  width: 100%;
  height: 330rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border: 1rpx solid var(--color-line);
  border-radius: 14rpx;
  background: #fafbfa;
  color: var(--color-text);
  font-family: monospace;
  font-size: 20rpx;
  line-height: 1.55;
}

.backup-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-top: 20rpx;
}

.snapshot-action {
  width: 100%;
  margin-top: 18rpx;
  text-align: center;
}

.about-card {
  margin-top: 52rpx;
  padding: 30rpx 6rpx;
  border-top: 1rpx solid var(--color-line);
}

.about-title-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.about-seal {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 24rpx;
}

.about-name,
.about-copy {
  display: block;
}

.about-name {
  color: var(--color-text);
  font-weight: 700;
}

.about-copy {
  margin-top: 10rpx;
  color: var(--color-subtle);
  font-size: 22rpx;
  line-height: 1.6;
}
</style>
