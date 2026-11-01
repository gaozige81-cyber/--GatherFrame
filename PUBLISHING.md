# 发布拾材

这个仓库只保存源码。Windows/Mac 安装包请放到 GitHub Releases，保持 ShiCai-版本-平台-Installer.zip / Windows-x64-Setup.exe 的文件命名。

推荐使用与版本配套的 GitHub-OneClick 发布包：完整解压，在 Windows 上双击“上传到GitHub.cmd”，完成 GitHub 登录并选择仓库。脚本会上传源码、生成版本标签、先创建草稿，全部附件通过校验后才正式发布。

新建仓库时源码放在默认分支；已有仓库使用独立的 shicai-v版本 分支，保留原默认分支。不强推、不覆盖正式 Release 的同名附件。上传中断可再次运行，同名文件必须与本地 SHA-256 完全一致才跳过。

首次发布后的仓库地址可以直接填到拾材的软件更新设置；脚本会输出“上传结果.txt”。当前安装包仍需用户手动填写一次更新源，不会在上传时被改写。

若仅想上传草稿：运行 Upload-GitHub.ps1 -DraftOnly。若只检查本地包：运行 Upload-GitHub.ps1 -ValidateOnly。这两个脚本位于独立发布包中，不需要把大型安装包提交到 Git 仓库。
