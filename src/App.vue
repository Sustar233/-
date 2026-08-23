<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { ensurePresetKnowledge } from '@/services/presetKnowledgeService'

onLaunch(async () => {
  try {
    await ensurePresetKnowledge()
  } catch (error) {
    console.warn('预设知识卡初始化失败，将在读取知识库时重试。', error)
  }
})
</script>

<style>
page {
  --color-bg: #f6f7f5;
  --color-surface: #ffffff;
  --color-surface-strong: #ffffff;
  --color-text: #202521;
  --color-muted: #6f766f;
  --color-subtle: #959b95;
  --color-line: #e2e5e1;
  --color-primary: #28624f;
  --color-primary-dark: #1e493c;
  --color-primary-soft: #edf4f0;
  --color-accent: #9a6548;
  --color-accent-soft: #f6eee9;
  --color-danger: #a3453e;
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 28rpx;
}

view,
text,
input,
textarea,
button {
  box-sizing: border-box;
}

button {
  margin: 0;
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 1.2;
  transition: opacity 160ms ease, transform 160ms ease, background-color 160ms ease;
}

button::after {
  border: 0;
}

button:active {
  transform: translateY(1rpx);
  opacity: 0.88;
}

button[disabled] {
  opacity: 0.5;
}

.page-shell {
  width: 100%;
  max-width: 860rpx;
  min-height: 100vh;
  margin: 0 auto;
  padding: 34rpx 30rpx calc(72rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
}

@media (min-width: 900px) {
  .page-shell,
  .review-page {
    max-width: 960rpx;
  }
}

.safe-top {
  padding-top: calc(30rpx + env(safe-area-inset-top));
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 42rpx 2rpx 18rpx;
}

.section-title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 720;
}

.muted {
  color: var(--color-muted);
  font-size: 23rpx;
}

.surface {
  background: var(--color-surface);
  border: 1rpx solid var(--color-line);
  border-radius: 18rpx;
}

.primary-button {
  padding: 26rpx 32rpx;
  background: var(--color-primary);
  color: #ffffff;
  font-weight: 740;
}

.secondary-button {
  padding: 22rpx 28rpx;
  border: 1rpx solid #cfddd5;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 680;
}

.danger-button {
  padding: 20rpx 26rpx;
  border: 1rpx solid #ecd3d0;
  background: #fbefed;
  color: var(--color-danger);
}

.text-button {
  padding: 12rpx;
  background: transparent;
  color: var(--color-primary);
  font-size: 25rpx;
}

.page-heading {
  margin: 10rpx 2rpx 36rpx;
}

.eyebrow,
.page-title,
.page-subtitle {
  display: block;
}

.eyebrow {
  color: var(--color-accent);
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.page-title {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 46rpx;
  font-weight: 800;
}

.page-subtitle {
  margin-top: 10rpx;
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.65;
}

.field-label {
  display: block;
  margin: 26rpx 0 12rpx;
  color: #525a53;
  font-size: 25rpx;
  font-weight: 680;
}

.field-input,
.field-textarea,
.picker-field {
  width: 100%;
  background: var(--color-surface-strong);
  border: 1rpx solid #d9ddd8;
  border-radius: 14rpx;
  color: var(--color-text);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.field-input {
  /* uni-input defaults to 1.4em tall on H5; give its native input a real focus area. */
  height: 88rpx;
  min-height: 88rpx;
  padding: 0 26rpx;
}

.field-textarea,
.picker-field {
  padding: 24rpx 26rpx;
}

.field-textarea {
  min-height: 210rpx;
  line-height: 1.65;
}

.field-input:focus-within,
.field-textarea:focus,
.picker-field:active {
  border-color: #7a9f8f;
  box-shadow: 0 0 0 4rpx rgba(40, 98, 79, 0.08);
}

input,
textarea {
  caret-color: var(--color-primary);
}

.inline-form {
  display: flex;
  gap: 16rpx;
  margin: 20rpx 0;
}

.inline-form .field-input {
  flex: 1;
}

.inline-form button {
  flex: 0 0 auto;
  padding: 20rpx 26rpx;
}

.empty-copy {
  padding: 70rpx 30rpx;
  color: var(--color-muted);
  text-align: center;
  line-height: 1.7;
}

@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
