# 苦作舟

基于 uni-app、Vue 3 和 FSRS 的个人知识复习工具，支持 H5 与微信小程序。

## 微信小程序开发

1. 安装依赖：

   ```bash
   npm install
   ```

2. 启动微信小程序开发构建：

   ```bash
   npm run dev:mp-weixin
   ```

3. 在微信开发者工具中导入以下目录：

   ```text
   dist/dev/mp-weixin
   ```

`src/manifest.json` 中的 `mp-weixin.appid` 留空时，构建产物会使用 `touristappid`，可用于开发者工具本地调试。若需要真机预览、上传或发布，请把该字段替换为你在微信公众平台申请的真实小程序 AppID，然后重新构建。

微信小程序端使用微信原生本地存储，与 H5 的局域网共享数据相互独立。可以通过应用“设置 → 数据备份”中的 JSON 导出与导入功能迁移数据。

## 生产构建

```bash
npm run build:mp-weixin
```

生产产物位于 `dist/build/mp-weixin`，可直接导入微信开发者工具。

## 质量检查

```bash
npm run type-check
npm test
```
