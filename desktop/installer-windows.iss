#ifndef Payload
#error Supply /DPayload=path-to-assembled-runtime
#endif
#ifndef Output
#define Output "..\release"
#endif
#define AppName "拾材"
#define AppVersion "2.3.0"
[Setup]
AppId=app.shicai.desktop
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=ShiCai
AppCopyright=ShiCai Desktop 2026
DefaultDirName={localappdata}\Programs\ShiCai
DefaultGroupName=拾材
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableDirPage=no
DisableProgramGroupPage=yes
AllowRootDirectory=no
AllowUNCPath=no
OutputDir={#Output}
OutputBaseFilename=ShiCai-2.3.0-Windows-x64-Setup
SetupIconFile={#Payload}\resources\app\icon.ico
UninstallDisplayIcon={app}\resources\app\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
CloseApplicationsFilter=拾材.exe
RestartApplications=no
SetupLogging=yes
UninstallDisplayName=拾材 2.3.0
VersionInfoVersion=2.3.0.1
VersionInfoDescription=拾材 Windows 安装程序
[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\拾材"; Filename: "{app}\拾材.exe"; WorkingDir: "{app}"
Name: "{group}\卸载拾材"; Filename: "{uninstallexe}"
Name: "{autodesktop}\拾材"; Filename: "{app}\拾材.exe"; WorkingDir: "{app}"; Tasks: desktopicon
[Run]
Filename: "{app}\拾材.exe"; Description: "打开拾材"; Flags: nowait postinstall skipifsilent
