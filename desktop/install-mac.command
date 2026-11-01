#!/bin/bash
set -euo pipefail
base="$(cd -- "$(dirname -- "$0")" && pwd)"
cpu="$(uname -m)"
if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" == 1 ]]; then cpu=arm64; fi
expected_cpu="__SHICAI_ARCH__"
if [[ "$(uname -s)" != Darwin || "$cpu" != arm64 && "$cpu" != x86_64 ]]; then
  printf '请在对应架构的 macOS 电脑上运行。\n'
  exit 1
fi
if [[ "$cpu" != "$expected_cpu" ]]; then
  printf '这个安装包适用于 %s，当前终端架构为 %s。请下载与你的 Mac 芯片对应的版本。\n' "$expected_cpu" "$cpu"
  exit 1
fi
minimum="__SHICAI_MIN_OS__"
actual="$(sw_vers -productVersion)"
IFS=. read -r os_major os_minor os_patch <<< "$actual"
IFS=. read -r min_major min_minor min_patch <<< "$minimum"
actual_number=$((10#${os_major} * 10000 + 10#${os_minor:-0} * 100 + 10#${os_patch:-0}))
minimum_number=$((10#${min_major} * 10000 + 10#${min_minor:-0} * 100 + 10#${min_patch:-0}))
if (( actual_number < minimum_number )); then
  printf '本安装包需要 macOS %s 或更新版本；当前系统为 %s。请改用旧系统兼容包。\n' "$minimum" "$actual"
  exit 1
fi
if [[ ! -d "$base/拾材.app" ]]; then
  printf '找不到拾材.app，请先完整解压安装包。\n'
  exit 1
fi
mkdir -p "$HOME/Applications"
stage="$(mktemp -d "$HOME/Applications/.shicai-install.XXXXXX")"
trap 'rm -rf -- "$stage"' EXIT
ditto "$base/拾材.app" "$stage/拾材.app"
codesign --force --deep --sign - --entitlements "$base/entitlements.plist" "$stage/拾材.app"
codesign --verify --deep --strict "$stage/拾材.app"
target="$HOME/Applications/拾材.app"
if [[ -e "$target" ]]; then
  backup="$HOME/Applications/拾材-旧版-$(date +%Y%m%d-%H%M%S).app"
  mv "$target" "$backup"
  printf '旧版已备份到：%s\n' "$backup"
fi
mv "$stage/拾材.app" "$target"
if [[ -d "$HOME/Desktop" && ! -e "$HOME/Desktop/拾材.app" ]]; then
  ln -s "$target" "$HOME/Desktop/拾材.app"
fi
printf '安装完成：%s\n' "$target"
printf '此安装包采用本机签名，未经过 Apple 开发者公证。首次打开请按系统提示检查并允许。\n'
read -r -p '按回车键打开拾材…' _
open "$target"
