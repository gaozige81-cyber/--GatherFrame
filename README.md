# 拾材 / ShiCai 2.3.0

搜图、整理素材、处理图片，以及不懂 API 也能使用的海报助手。

## 下载使用

请打开本仓库右侧的 **Releases**，下载适合电脑的安装包。安装包放在 Release 附件中，不需要下载源码来运行。

| 电脑 | 请选择 |
| --- | --- |
| Windows 10/11，64 位 | Windows-x64-Setup.exe |
| Intel Mac，macOS 12+ | macOS-x64-Installer.zip |
| Intel Mac，macOS 10.14–11 | macOS-x64-Legacy-Installer.zip |
| Apple 芯片 Mac，macOS 12+ | macOS-arm64-Installer.zip |
| Apple 芯片 Mac，macOS 11 | macOS-arm64-BigSur-Installer.zip |

Mac 完整解压后运行“安装拾材.command”。Mac 包未经过 Apple Developer ID 公证，尚未实机验收；旧系统版使用已结束安全维护的运行环境，能运行常规版时优先使用常规版。

## 可以做什么

- 关键词搜图、加载更多、预览和保存原图，47 个分类搜图网站及自定义入口。
- 素材收集、尺寸与格式检测、批量图片转换及项目清单整理。
- 默认免配置 AI 模式：写需求，复制提示词并打开官网，用自己的账号生成，再导回拾材处理。
- 可选软件内生图：接入十个生图平台的 API，支持可选的系统加密记住连接。
- 头像与姓名设置，以及“时归制作”界面署名。

官网模式仍由用户在官网登录、粘贴和生成；账户权益、费用及额度以各平台为准。接口适配经过模拟测试，尚未逐个平台使用真实付费账户验收。

## 检测更新

在拾材“偏好设置 → 软件更新”中填写本仓库的公开 GitHub 地址。应用读取正式 Release，按平台和兼容版本匹配安装包；草稿和私有仓库不能供未登录客户端检查。

## 开发和发布

开发、构建及完整功能说明见 [DEVELOPMENT.md](DEVELOPMENT.md)。发布流程见 [PUBLISHING.md](PUBLISHING.md)。第三方组件许可见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。
