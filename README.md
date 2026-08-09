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

项目已在 `src/manifest.json` 中配置微信小程序 AppID `wx5b914c7d954302ad`，构建产物可用于开发者工具真机预览与上传。正式发布前仍需在微信公众平台完成小程序名称、类目、隐私说明和版本审核。

微信小程序端使用微信原生本地存储，与 H5 的局域网共享数据相互独立。可以通过应用“设置 → 数据备份”中的 JSON 导出与导入功能迁移数据。

## H5 局域网调试

需要让同一局域网内的设备访问 H5 调试页时，可运行：

```bash
npm run dev:lan
```

H5 开发模式使用 `.recalllab-data` 中的共享数据，`dev:h5` 仅监听本机，`dev:lan` 会额外允许局域网设备访问。局域网模式仅应在可信的私人网络中短时使用，不要将端口转发到公网，也不要在公共 Wi-Fi 中启动。

H5 正式构建不依赖开发服务器的 `/api/storage/`，会自动使用当前浏览器的本地存储。开发环境、正式网页和微信小程序的数据彼此独立，可以通过应用内 JSON 备份迁移。

## 生产构建

```bash
npm run build:h5
npm run build:mp-weixin
```

H5 产物位于 `dist/build/h5`；微信小程序产物位于 `dist/build/mp-weixin`，可直接导入微信开发者工具。

评分、撤销、级联删除和备份导入使用批量事务写入。本地存储若在写入中途被关闭，会在下次访问数据前自动完成未结束的事务。

## 质量检查

```bash
npm run type-check
npm test
```
