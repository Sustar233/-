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
  --color-bg: #061629;
  --color-surface: rgba(8, 31, 54, 0.94);
  --color-surface-strong: #0d2944;
  --color-text: #f4e8cb;
  --color-muted: #aab8c4;
  --color-subtle: #788b9c;
  --color-line: rgba(215, 176, 105, 0.34);
  --color-primary: #67d8c5;
  --color-primary-dark: #0c5550;
  --color-primary-soft: rgba(70, 177, 159, 0.16);
  --color-accent: #d7ad66;
  --color-accent-soft: rgba(215, 173, 102, 0.15);
  --color-danger: #eb8279;
  --font-display: "STKaiti", "KaiTi", "FangSong", serif;
  min-height: 100%;
  background-color: var(--color-bg);
  background-image:
    radial-gradient(circle at 4% 13%, rgba(255, 231, 177, 0.62) 0, rgba(255, 231, 177, 0.62) 1rpx, transparent 2rpx),
    radial-gradient(circle at 13% 71%, rgba(132, 196, 226, 0.34) 0, rgba(132, 196, 226, 0.34) 1rpx, transparent 2rpx),
    radial-gradient(circle at 27% 28%, rgba(255, 255, 255, 0.24) 0, rgba(255, 255, 255, 0.24) 1rpx, transparent 2rpx),
    radial-gradient(circle at 34% 87%, rgba(220, 179, 104, 0.4) 0, rgba(220, 179, 104, 0.4) 1rpx, transparent 2rpx),
    radial-gradient(circle at 62% 15%, rgba(154, 207, 232, 0.34) 0, rgba(154, 207, 232, 0.34) 1rpx, transparent 2rpx),
    radial-gradient(circle at 72% 66%, rgba(255, 229, 173, 0.4) 0, rgba(255, 229, 173, 0.4) 1rpx, transparent 2rpx),
    radial-gradient(circle at 83% 34%, rgba(255, 255, 255, 0.26) 0, rgba(255, 255, 255, 0.26) 1rpx, transparent 2rpx),
    radial-gradient(circle at 92% 82%, rgba(137, 200, 225, 0.34) 0, rgba(137, 200, 225, 0.34) 1rpx, transparent 2rpx),
    radial-gradient(circle at 97% 9%, rgba(231, 190, 116, 0.5) 0, rgba(231, 190, 116, 0.5) 1rpx, transparent 2rpx),
    radial-gradient(ellipse at 18% -8%, rgba(43, 91, 132, 0.42) 0%, transparent 45%),
    radial-gradient(ellipse at 88% 24%, rgba(78, 54, 112, 0.22) 0%, transparent 38%),
    radial-gradient(ellipse at 70% 62%, rgba(64, 111, 142, 0.1) 0%, transparent 24%),
    radial-gradient(ellipse at 48% 108%, rgba(19, 101, 105, 0.17) 0%, transparent 42%),
    linear-gradient(160deg, #041221 0%, #071b31 52%, #051426 100%);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-attachment: fixed;
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
  background-image:
    radial-gradient(circle at 7% 4%, rgba(255, 224, 158, 0.66) 0, rgba(255, 224, 158, 0.66) 1rpx, transparent 2rpx),
    radial-gradient(circle at 91% 7%, rgba(154, 205, 230, 0.5) 0, rgba(154, 205, 230, 0.5) 1rpx, transparent 2rpx),
    radial-gradient(circle at 19% 18%, rgba(255, 255, 255, 0.3) 0, rgba(255, 255, 255, 0.3) 1rpx, transparent 2rpx),
    radial-gradient(circle at 77% 24%, rgba(229, 188, 116, 0.5) 0, rgba(229, 188, 116, 0.5) 1rpx, transparent 2rpx),
    radial-gradient(circle at 12% 39%, rgba(138, 194, 220, 0.38) 0, rgba(138, 194, 220, 0.38) 1rpx, transparent 2rpx),
    radial-gradient(circle at 96% 45%, rgba(255, 225, 164, 0.36) 0, rgba(255, 225, 164, 0.36) 1rpx, transparent 2rpx),
    radial-gradient(circle at 68% 57%, rgba(255, 255, 255, 0.28) 0, rgba(255, 255, 255, 0.28) 1rpx, transparent 2rpx),
    radial-gradient(circle at 4% 69%, rgba(216, 174, 104, 0.36) 0, rgba(216, 174, 104, 0.36) 1rpx, transparent 2rpx),
    radial-gradient(circle at 84% 78%, rgba(136, 196, 221, 0.32) 0, rgba(136, 196, 221, 0.32) 1rpx, transparent 2rpx),
    radial-gradient(circle at 25% 91%, rgba(255, 224, 158, 0.4) 0, rgba(255, 224, 158, 0.4) 1rpx, transparent 2rpx);
  background-size: 100% 100%;
  background-repeat: no-repeat;
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
  margin: 46rpx 2rpx 20rpx;
}

.section-title {
  color: var(--color-text);
  font-size: 32rpx;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 2rpx;
}

.muted {
  color: var(--color-muted);
  font-size: 23rpx;
}

.surface {
  background: linear-gradient(145deg, rgba(12, 39, 65, 0.96), rgba(7, 27, 48, 0.96));
  border: 1rpx solid var(--color-line);
  border-radius: 24rpx;
  box-shadow: 0 16rpx 42rpx rgba(0, 5, 16, 0.28);
}

.primary-button {
  padding: 26rpx 32rpx;
  border: 1rpx solid rgba(151, 231, 214, 0.52);
  background: linear-gradient(135deg, #16786f 0%, #0b5753 100%);
  color: #fff1d2;
  font-weight: 740;
  box-shadow: 0 12rpx 28rpx rgba(0, 9, 20, 0.26);
}

.secondary-button {
  padding: 22rpx 28rpx;
  border: 1rpx solid rgba(103, 216, 197, 0.36);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 680;
}

.danger-button {
  padding: 20rpx 26rpx;
  border: 1rpx solid rgba(235, 130, 121, 0.35);
  background: rgba(132, 48, 53, 0.2);
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
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 2rpx;
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
  color: var(--color-muted);
  font-size: 25rpx;
  font-weight: 680;
}

.field-input,
.field-textarea,
.picker-field {
  width: 100%;
  background: var(--color-surface-strong);
  border: 1rpx solid rgba(215, 176, 105, 0.31);
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
  border-color: rgba(103, 216, 197, 0.72);
  box-shadow: 0 0 0 5rpx rgba(103, 216, 197, 0.1);
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
