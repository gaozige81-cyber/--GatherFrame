# 检测更新

当前没有预设发布地址，`app/update-channel.json` 的 source 为空、autoCheck 为 false。此时不会发起更新请求，也不会显示“已是最新版”。

## 在应用中配置

偏好设置 → 软件更新，填写以下任一公开地址并保存：

- GitHub 仓库，例如 `https://github.com/你的用户名/拾材仓库`。应用读取该仓库最新的正式 Release。
- 自有网站上的 HTTPS JSON 版本信息地址，格式见 `update-feed.example.json`。示例域名需要替换后才能使用。

可开启“启动时自动检查”。每次启动最多尝试一次，跨启动按 6 小时间隔限制；手动“检查更新”不受该间隔限制。“帮助 → 检查更新”也可手动检查。

发现新版后提示用户打开下载链接。该功能只检测版本和打开用户选择的下载链接，不自动下载、执行安装器或退出应用。安装、代码签名和 Apple 公证仍由发布流程处理。

## GitHub Releases

公开仓库无需在应用内放置 GitHub 密钥。使用 `v2.2.5` 或 `2.2.5` 形式的正式版本标签；预览版、草稿和无效版本不会被当作正式更新。

上传与现有命名方式一致的文件，应用会按当前平台和程序架构选择：

| 平台 | 文件示例 |
| --- | --- |
| Windows x64 | ShiCai-2.2.5-Windows-x64-Setup.exe |
| macOS Apple 芯片 | ShiCai-2.2.5-macOS-arm64-Installer.zip |
| macOS Intel | ShiCai-2.2.5-macOS-x64-Installer.zip |

缺少当前系统安装包时仍会提示有新版本，可以打开发布页，不会选用其他系统安装包。

接口依据：[GitHub 最新 Release 文档](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)。

## 给之后分发的安装包预设更新源

准备好正式发布地址后，可在 `desktop/app/update-channel.json` 中填写 source，并按需要设 autoCheck 为 true，再重建三个平台的安装包。用户本机已保存的更新设置优先于包内默认设置。更新设置存入独立的 `update-settings.json`，不覆盖头像、素材或 AI 账号资料。

已有 2.2.4 用户可以直接在设置中填写发布地址，无需为填写地址重新安装。当前包没有真实发布服务，已通过模拟响应验证版本比较、平台匹配、失败处理、并发请求与启动间隔；真实服务发布后还需做一次联网验收。

## 2.2.5 兼容包更新渠道

`distribution.json` 随安装包固定渠道，不由用户设置覆盖。常规渠道排除 Legacy/BigSur 文件；legacy 仅匹配 `macOS-x64-Legacy-Installer.zip`，bigsur 仅匹配 `macOS-arm64-BigSur-Installer.zip`。JSON 更新源使用 `darwin-x64-legacy` 与 `darwin-arm64-bigsur` 键。缺少对应渠道文件时保留版本提示与发布页，不回退到要求更高系统的常规包。发布者需维持各渠道最低系统要求。
