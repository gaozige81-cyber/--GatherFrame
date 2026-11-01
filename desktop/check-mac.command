#!/bin/bash
set -eu
printf '系统版本：%s\n' "$(sw_vers -productVersion)"
cpu="$(uname -m)"
if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" == 1 ]]; then cpu=arm64; fi
printf '芯片类型：%s\n' "$cpu"
major="$(sw_vers -productVersion | cut -d. -f1)"
if (( major >= 12 )); then
  printf '建议：常规版（Intel 选 x64，Apple 芯片选 arm64）。\n'
elif [[ "$cpu" == arm64 ]]; then
  printf '建议：macOS 11 的 Apple 芯片选 BigSur 兼容版。\n'
else
  printf '建议：macOS 10.14–11 的 Intel Mac 选 Legacy 旧系统兼容版。\n'
fi
printf 'macOS 10.13 及以下不在本次支持范围。未收集或上传任何设备信息。\n'
read -r -p '按回车结束…' _
