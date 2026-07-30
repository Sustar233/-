<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // Storage is initialized lazily by each store to keep startup lightweight.
})
</script>

<style>
page {
  --color-bg: #f6f1e8;
  --color-surface: #fffdf8;
  --color-surface-strong: #ffffff;
  --color-text: #222822;
  --color-muted: #727870;
  --color-subtle: #979b94;
  --color-line: #e5ded2;
  --color-primary: #1f5a49;
  --color-primary-dark: #174538;
  --color-primary-soft: #e4eee8;
  --color-accent: #b9683d;
  --color-accent-soft: #f3e2d4;
  --color-danger: #a8473f;
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
  border-radius: 16rpx;
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

.safe-top {
  padding-top: calc(30rpx + env(safe-area-inset-top));
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 46rpx 2rpx 20rpx;
}

.section-title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 760;
  letter-spacing: 0.5rpx;
}

.muted {
  color: var(--color-muted);
  font-size: 23rpx;
}

.surface {
  background: var(--color-surface);
  border: 1rpx solid var(--color-line);
  border-radius: 24rpx;
  box-shadow: 0 14rpx 36rpx rgba(61, 49, 33, 0.055);
}

.primary-button {
  padding: 26rpx 32rpx;
  background: var(--color-primary);
  color: #ffffff;
  font-weight: 740;
  box-shadow: 0 10rpx 24rpx rgba(31, 90, 73, 0.14);
}

.secondary-button {
  padding: 22rpx 28rpx;
  border: 1rpx solid #ccddd3;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 680;
}

.danger-button {
  padding: 20rpx 26rpx;
  border: 1rpx solid #ecd0cb;
  background: #faece8;
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
  font-weight: 760;
  letter-spacing: 3rpx;
}

.page-title {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 48rpx;
  font-weight: 820;
  letter-spacing: -1rpx;
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
  color: #555d55;
  font-size: 25rpx;
  font-weight: 680;
}

.field-input,
.field-textarea,
.picker-field {
  width: 100%;
  background: var(--color-surface-strong);
  border: 1rpx solid #ddd5c8;
  border-radius: 18rpx;
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
  border-color: #6f9b88;
  box-shadow: 0 0 0 5rpx rgba(31, 90, 73, 0.08);
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
