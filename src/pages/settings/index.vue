<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { exportBackup, importBackup, parseBackup } from '@/services/backupService'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const dailyNewCards = ref('20')
const backupText = ref('')
const working = ref(false)

onShow(async () => {
  await settingsStore.load()
  dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
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
    content: '导入会覆盖当前全部科目、卡片和复习记录。建议先导出备份。',
    confirmColor: '#a9443d',
    success: async ({ confirm }) => {
      if (!confirm) return
      working.value = true
      try {
        await importBackup(backupText.value)
        await settingsStore.load()
        dailyNewCards.value = String(settingsStore.settings.dailyNewCards)
        uni.showToast({ title: '导入成功', icon: 'success' })
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
      <text class="eyebrow">PREFERENCES</text>
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
        <button class="secondary-button" :loading="working" @click="exportData">导出并复制</button>
        <button class="danger-button" :disabled="working || !backupText.trim()" @click="importData">
          导入并覆盖
        </button>
      </view>
    </view>

    <view class="about-card">
      <text class="about-name">RecallLab 1.0</text>
      <text class="about-copy">数据仅保存在当前设备。无账号、无云端、无额外追踪。</text>
    </view>
  </view>
</template>

<style scoped>
.page-heading {
  margin: 10rpx 2rpx 34rpx;
}

.eyebrow,
.page-title,
.page-subtitle {
  display: block;
}

.eyebrow {
  color: #7b8b82;
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.page-title {
  margin-top: 7rpx;
  font-size: 48rpx;
  font-weight: 800;
}

.page-subtitle {
  margin-top: 10rpx;
  color: #7d8781;
  font-size: 24rpx;
}

.setting-card,
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
  color: #7d8781;
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
  border: 1rpx solid #dce3dd;
  border-radius: 16rpx;
  background: #f9faf8;
  font-size: 30rpx;
  text-align: center;
}

.limit-unit {
  color: #6e7973;
}

.save-limit {
  margin-left: auto;
}

.backup-intro {
  display: block;
  color: #647068;
  font-size: 24rpx;
  line-height: 1.7;
}

.backup-textarea {
  width: 100%;
  height: 330rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border: 1rpx solid #dde4de;
  border-radius: 16rpx;
  background: #f7f8f6;
  color: #445149;
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

.about-card {
  margin-top: 52rpx;
  padding: 30rpx 6rpx;
  border-top: 1rpx solid #dde3de;
}

.about-name,
.about-copy {
  display: block;
}

.about-name {
  color: #516058;
  font-weight: 700;
}

.about-copy {
  margin-top: 10rpx;
  color: #909893;
  font-size: 22rpx;
  line-height: 1.6;
}
</style>
