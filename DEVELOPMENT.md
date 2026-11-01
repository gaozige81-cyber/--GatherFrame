# 拾材 2.3.0：搜图与素材准备工作室

拾材围绕一个设计项目工作：导入候选 → 检测源图 → 筛选与处理 → 整理交付。它不是搜索引擎的镜像，也不承诺任何图片均可商用。素材源站访问取决于用户的网络、网站规则与版权许可。

## 使用

1. 默认进入“寻找图片”，关键词可直接返回全网图片。每批合并原关键词和相关检索词并去重，点击“加载更多图片”继续找图；可单独选择三个公共图库。卡片或详情中的“保存原图”直接保存图片文件。左侧“搜图网站”提供 47 个分类网站及自定义入口，支持带关键词在浏览器打开。
2. 在“网页导入”中粘贴公开网页地址、图片直链（每行一个），或在 Wikimedia Commons、Openverse、芝加哥艺术博物馆并行寻找候选。国内入口仅打开搜索结果页，随后从具体公开页面提取；不会伪称已接入其取图接口。
2. 将候选加入“素材收集箱”，给项目命名，在“项目验收标准”中设置长边、真实格式、透明像素要求及分类方式。每批最多 12 张；检测会读取真实文件、分辨率、静态 PNG 透明像素、近似主色、SHA-256，并报告失败原因。收集箱上限 200 张，本机源图缓存上限 120 MB；断网后已缓存源图仍可再次整理。缓存和清单只在当前设备。
3. 将达标源图送入“图片处理”，或保存原始字节 ZIP、选片预览 PNG、项目清单 JSON。ZIP 包含来源与检测清单；浏览器版的下载是否真正落盘由浏览器负责确认。格式转换在本机进行：PNG、JPG、WebP、AVIF、TIFF、BMP、GIF、ICO、SVG 位图包装；HEIC/HEIF 可以尝试导入。动图/多页通常只处理首帧/第一页，元数据、ICC、图层可能丢失；SVG 输出不是矢量描摹。
4. “最近任务”列出已检测、已交由浏览器、已保存、未完成或已取消的结果。本机偏好中可编辑头像、姓名、选择桌面版下载目录并清理缓存。可以导出/导入偏好备份及项目清单；清单不含图片字节。

用户资料和下载目录不打包进安装文件。桌面版独立运行，不要求在本机预先安装 Node。Windows x64 支持 Windows 10/11；Mac 常规版提供 Apple Silicon、Intel 两种 ZIP，支持 macOS 12+；Intel Legacy 兼容版面向 macOS 10.14–11，Apple 芯片 BigSur 兼容版面向 macOS 11。旧系统版使用已停止安全更新的 Electron 26.6.10 / 37.10.3，仅供无法升级系统的 Mac 选用。Mac 包在 Windows 装配，随包安装脚本会在真实 Mac 上做本机签名，但没有 Apple Developer ID 公证；本次未在 Mac 实机启动验证，须在目标电脑上试运行。外部素材检索仍需要联网，网络受限地区可尝试公开国内来源页和直接图片地址。

## AI 海报助手：默认免配置

默认进入“免配置 · 打开官网创作”：写需求 → 选风格、比例 → 复制提示词并打开官网 → 用自己的账号登录、粘贴、生成 → 保存后导回拾材处理。包含即梦、豆包、ChatGPT Images、Gemini、通义万相、Adobe Firefly、Midjourney、Ideogram、Recraft、Grok 的官方入口。

提示词由本地模板整理，不会在填写时调用云端 AI。拾材不读取浏览器的登录状态，不自动提交官网生成任务，也不会把网页登录权益转成 API 额度。官网功能、登录和价格以平台为准。

切换到“在拾材内生成 · 连接平台”，可以选择 OpenAI、Google Gemini/Nano Banana、豆包 Seedream、千问图像、硅基流动、FLUX、Ideogram、Recraft、Stability AI、Grok 的 API。软件自动填入地址、默认模型与协议；通常只需取得密钥并点击启用。高级设置保留自定义模型、地址与协议。文字策划继续支持 OpenAI、DeepSeek、百炼和硅基流动。

账号/API 额度由用户自己的服务商提供。没有内置付费密钥，也没有伪装的免费云服务。Google 的 Interactions、FLUX 的异步轮询、Ideogram/Stability 的表单接口已独立适配；不会把所有平台当作同一种接口。

可选“在这台电脑记住密钥”：使用 Electron safeStorage 调用系统加密，密文保存在用户数据目录的 ai-credentials.json，不写入偏好备份、项目清单或安装包。默认不勾选，默认仅在本次运行中保留。更换地址/协议会清除旧连接的密钥；断开会移除记住的密钥。系统加密不可用时不允许记住，不降级为明文。Windows 使用当前系统账户的 DPAPI，不能防止同账户下其他软件读取；Mac 使用钥匙串，本机签名升级后可能需要系统重新授权。

OpenAI 官方已停用 gpt-image-1，因此仅对官方地址的旧默认迁移至 gpt-image-2.5-flare；自定义网关上的同名模型保持原配置。各预设模型及 API 以 2026-10-31 核对的官方文档为依据，账户仍需开通相应模型。更多模型可在高级设置手动填写。

验证覆盖 10 种生图服务适配、密钥与下载域名隔离、单次提交、防重复异步生成、系统加密存储的模拟恢复、旧运行环境和 Windows 实际界面。未使用真实付费账户逐个平台完成生图，Mac 仍未实机启动验收。

服务清单及官方文档在 desktop/app/ai-catalog.json。

## 开发与验证

项目 Site 使用 Vinext；桌面 UI 由 Vite 打包，Electron 仅访问内置的本机 127.0.0.1 服务。Node.js >=22.13。执行：

```bash
npm install
node node_modules/typescript/bin/tsc --noEmit
node desktop/build.mjs
node desktop/check-upgrade.mjs
node desktop/check-desktop.cjs
node desktop/check-workbench.mjs
node desktop/check-ai.cjs
node desktop/check-codecs.mjs
node node_modules/vite/bin/vite.js build --config desktop/vite.config.mjs
npm run build
```

`check-ai` 使用模拟的模型响应检查请求、拒绝异常图片与密钥生命周期，不执行收费调用。`check-codecs` 需要 `@napi-rs/canvas` 与 `sharp` 作像素解码校验；可作为开发依赖安装。`npm run build` 用于站点，正式发布由 Sites 的部署流程完成。

要重建安装包，将 Electron 官方 v44.9.1 的 `win32-x64`、`darwin-arm64`、`darwin-x64` ZIP 以及同一版本的 `SHASUMS256.txt` 放入独立运行时目录；安装 NSIS `makensis` 后执行：

```bash
SHICAI_RUNTIME=/path/to/official-runtime \
SHICAI_OUTPUT=/path/to/release \
SHICAI_MAKENSIS=/path/to/makensis \
SHICAI_NSISDIR=/path/to/nsis/share/nsis \
python3 desktop/make-installers.py
```

脚本首先逐一核验官方 SHA-256，再装配便携运行时并生成 Windows 安装 EXE 和两种 Mac 安装 ZIP。Windows 安装在当前用户目录，允许自选其他盘符；下载用目标目录内临时文件写入并原子替换。`desktop/check-desktop.cjs` 覆盖跨文件系统保存、取消、无效目录、磁盘满、Windows 保留文件名等异常。真实 Windows/Mac GUI 安装验收必须在目标系统进行。

发布前的安装包检查还会核对 Windows EXE 的 NSIS 末尾 CRC。曾有一个 2.2.0 构建缺少最后 4 字节，虽能计算 SHA-256，却无法通过安装器自身校验；这项检查会阻止同类文件再次被标为可分发。

## 发布到 GitHub

发布源码时使用干净的源码导出包，不提交 `.openai/hosting.json`、`.git`、`.env`、`node_modules`、构建输出、私有部署身份、下载缓存或用户资料。GitHub 仓库可设为私有先审查，再按需要公开；大体积的 EXE 和 Mac ZIP 放进 GitHub Releases，不写入 Git 历史。将对应的 `SHA256SUMS.txt` 与安装包同放在一个 Release 里以便核对。需要自动化公证或更新签名时，另行配置你自己的证书和 CI Secret，切勿提交密钥。查看 [海报策划方案](POSTER-AI-PLAN.md)、[升级提示词](UPGRADE-PROMPT.md) 与第三方组件声明。


Mac ZIP 可在任意系统装配，保留 Unix 文件模式及符号链接：

```bash
python desktop/make-mac-installers.py --runtime /path/to/official-runtime --output /path/to/release
```

这一步先核对 Electron 官方 SHA-256，随后逐文件比对应用内容，检查 arm64/x64 二进制架构、执行权限和符号链接。Apple Developer ID 签名和公证需要你自己的证书及 Mac 构建环境。

Windows 本次发行使用 Inno Setup 6。准备好官方运行时及编译后的 desktop/app 后，可用 desktop/package-release.py 装配 Windows 目录（SHICAI_ARCHES=win32-x64），再编译：

```powershell
ISCC.exe /DPayload=C:\path\to\win32-x64 /DOutput=C:\path\to\release desktop\installer-windows.iss
```


## 检测更新

在“偏好设置 → 软件更新”中配置公开 GitHub 仓库或 HTTPS 版本信息地址。支持启动检查（每 6 小时最多一次）、手动检查、版本提示及按 Windows/Apple 芯片/Intel 选择下载链接。当前没有预设发布地址，未配置时不会自动联网检查。该功能不自动下载或执行安装器。发布格式、包内默认地址与模拟检查见 [更新接入说明](desktop/UPDATES.md)。

## 2.2.5 的署名与 Mac 兼容包

界面底部右侧显示两行署名：“时归制作”“希望看到这段文字的你天天开心”。不会写入导出的图片。

Mac 常规版运行环境为 Electron 43.8.3；Windows 保留 44.9.1。打包校验会检查全部 Mach-O 文件的最低系统版本、执行权限、符号链接、官方运行时 SHA-256 与应用文件一致性。每个 Mac 包附“检查我的Mac.command”，只在屏幕显示系统与芯片信息，不上传设备信息。机型年份不能替代系统版本；2019 Intel Mac 可先尝试 Legacy 兼容包，已升级到 12+ 的建议常规 x64 包。

Legacy / BigSur 安装包携带各自更新渠道；以后发布更新时必须提供对应兼容包，缺少时只显示发布页，不会误选常规包。当前仍无正式更新源，不会自动联网检查。
