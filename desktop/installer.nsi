Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "FileFunc.nsh"
!ifndef PAYLOAD
!error "PAYLOAD is required"
!endif
!ifndef OUTPUT
!error "OUTPUT is required"
!endif
Name "拾材 · 素材收集与转换"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\ShiCai"
InstallDirRegKey HKCU "Software\ShiCai" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID zlib
Icon "${PAYLOAD}\resources\app\icon.ico"
UninstallIcon "${PAYLOAD}\resources\app\icon.ico"
VIProductVersion "2.3.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "拾材 · 素材收集与转换"
VIAddVersionKey /LANG=2052 "FileDescription" "拾材安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "2.3.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "ShiCai Desktop 2026"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "欢迎使用拾材"
!define MUI_WELCOMEPAGE_TEXT "将素材收集与图片转换工具安装到这台电脑。$\r$\n$\r$\n界面无需登录即可打开；本地图片转换可离线使用。素材检索与下载需要联网。$\r$\n$\r$\n适用系统：Windows 10 / 11，64位。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\拾材.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开拾材"
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateInstallDir
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
Function ValidateInstallDir
 ${GetRoot} "$INSTDIR" $0
 StrCmp "$INSTDIR" "$0\" 0 +2
  StrCpy $INSTDIR "$INSTDIR\ShiCai"
 StrCmp "$INSTDIR" "$0" 0 +2
  StrCpy $INSTDIR "$INSTDIR\ShiCai"
 StrCmp "$INSTDIR" "$WINDIR" InvalidDir
 StrCmp "$INSTDIR" "$SYSDIR" InvalidDir
 ClearErrors
 CreateDirectory "$INSTDIR"
 IfErrors InvalidDir
 GetTempFileName $1 "$INSTDIR"
 IfErrors InvalidDir
 Delete "$1"
 Return
 InvalidDir:
 MessageBox MB_OK|MB_ICONSTOP "所选目录不可写或磁盘不可用。请选用如 D:\ShiCai 的独立文件夹，避免系统目录。"
 Abort
FunctionEnd
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_OK|MB_ICONSTOP "拾材需要64位 Windows 10或Windows 11。"
  Abort
 ${EndIf}
 ${IfNot} ${AtLeastWin10}
  MessageBox MB_OK|MB_ICONSTOP "拾材需要 Windows 10或更新版本。"
  Abort
 ${EndIf}
FunctionEnd
Section "拾材"
 SetShellVarContext current
 SetOutPath "$INSTDIR"
 File /r "${PAYLOAD}\*"
 WriteRegStr HKCU "Software\ShiCai" "InstallDir" "$INSTDIR"
 WriteUninstaller "$INSTDIR\卸载拾材.exe"
 CreateDirectory "$SMPROGRAMS\拾材"
 CreateShortcut "$SMPROGRAMS\拾材\拾材.lnk" "$INSTDIR\拾材.exe" "" "$INSTDIR\resources\app\icon.ico"
 CreateShortcut "$SMPROGRAMS\拾材\卸载拾材.lnk" "$INSTDIR\卸载拾材.exe"
 CreateShortcut "$DESKTOP\拾材.lnk" "$INSTDIR\拾材.exe" "" "$INSTDIR\resources\app\icon.ico"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "DisplayName" "拾材 · 素材收集与转换"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "DisplayVersion" "2.3.0"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "DisplayIcon" "$INSTDIR\resources\app\icon.ico"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "UninstallString" '$\"$INSTDIR\卸载拾材.exe$\"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai" "NoRepair" 1
SectionEnd
Section "Uninstall"
 SetShellVarContext current
 Delete "$DESKTOP\拾材.lnk"
 Delete "$SMPROGRAMS\拾材\拾材.lnk"
 Delete "$SMPROGRAMS\拾材\卸载拾材.lnk"
 RMDir "$SMPROGRAMS\拾材"
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\卸载拾材.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiCai"
 DeleteRegKey HKCU "Software\ShiCai"
SectionEnd
