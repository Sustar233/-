<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // Storage is initialized lazily by each store to keep startup lightweight.
})
</script>

<style>
page {
  min-height: 100%;
  background: #f6f7f3;
  color: #1c2923;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
  border-radius: 18rpx;
  font-size: 28rpx;
  line-height: 1.2;
}

button::after {
  border: 0;
}

.page-shell {
  width: 100%;
  max-width: 920rpx;
  min-height: 100vh;
  margin: 0 auto;
  padding: 34rpx 30rpx 60rpx;
}

.safe-top {
  padding-top: calc(30rpx + env(safe-area-inset-top));
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 42rpx 2rpx 20rpx;
}

.section-title {
  color: #1c2923;
  font-size: 32rpx;
  font-weight: 700;
}

.muted {
  color: #818a84;
}

.surface {
  background: #ffffff;
  border: 1rpx solid #e7ebe6;
  border-radius: 24rpx;
  box-shadow: 0 10rpx 30rpx rgba(28, 58, 45, 0.04);
}

.primary-button {
  padding: 26rpx 32rpx;
  background: #245b47;
  color: #ffffff;
  font-weight: 700;
}

.secondary-button {
  padding: 22rpx 28rpx;
  background: #eaf1ed;
  color: #245b47;
  font-weight: 650;
}

.danger-button {
  padding: 20rpx 26rpx;
  background: #fbeeed;
  color: #a9443d;
}

.text-button {
  padding: 12rpx;
  background: transparent;
  color: #47705f;
  font-size: 25rpx;
}

.field-label {
  display: block;
  margin: 26rpx 0 12rpx;
  color: #57625c;
  font-size: 25rpx;
  font-weight: 650;
}

.field-input,
.field-textarea,
.picker-field {
  width: 100%;
  background: #ffffff;
  border: 1rpx solid #dfe5df;
  border-radius: 18rpx;
  color: #1c2923;
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
  color: #818a84;
  text-align: center;
  line-height: 1.7;
}
</style>
