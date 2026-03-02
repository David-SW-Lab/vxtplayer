# Platform-Specific Implementation and Build Reference

## Supported Platform List

| Platform | Status | Directory |
|----------|--------|-----------|
| Tizen (Samsung TV) | Primary/Stable | `src/utils/platform/tizen/` |
| Android | Experimental | `src/utils/platform/android/` |
| Electron (Desktop) | Experimental | `src/utils/platform/electron/` |
| Web/Browser | Limited | `src/utils/platform/web/` |
| BrightSign | Supported | `resources/brightsign/` |

---

## vxtplayer-main Platform Abstraction

### Structure
```
src/utils/platform/
├── android/
│   └── index.ts    # Android platform API facade
├── electron/
│   └── index.ts    # Electron platform API facade
├── tizen/
│   └── index.ts    # Tizen platform API facade
└── web/
    └── index.ts    # Web platform API facade
```

### Android Platform API (Most Detailed Implementation)
All functions wrapped with `handleError` / `handleErrorAsync` decorators.

**File operations:**
```typescript
listFiles(path): Promise<File[]>
resolvePath(path): Promise<string>
doesFileExist(path): Promise<boolean>
copyFile(src, dst): Promise<void>
moveFile(src, dst): Promise<void>
createDirectory(path): Promise<void>
createFile(path): Promise<void>
deleteDirectory(path): Promise<void>
deleteFile(path): Promise<void>
readFileAsText(path): Promise<string>
readFileAsBase64(path): Promise<string>
readFileAsBytes(path): Promise<Uint8Array>
saveDataAsFile(data, path): Promise<void>
saveBytesAsFile(bytes, path): Promise<void>
appendDataToFile(data, path): Promise<void>
getDirectorySize(path): Promise<number>
getFileSizeFromPath(path): Promise<number>
openFileStream(path): {read(), close()}   // Stream-based
```

**Archive:**
```typescript
addFilesToArchive(files, archivePath): Promise<void>
extractArchiveTo(archivePath, destPath): Promise<void>
extractArchiveToUsingFileObject(archiveFile, destPath): Promise<void>
```

**Device info:**
```typescript
getMacAddress(): Promise<string>
getSerialNumber(): Promise<string>
getIpAddress(): Promise<string>
getSubnetMask(): Promise<string>
getBroadcastIp(): Promise<string>
getDeviceModel(): Promise<string>
getDeviceType(): Promise<string>
getScreenSize(): Promise<{width, height}>
getScreenResolution(): Promise<{width, height}>
getMemoryInfo(): Promise<MemoryInfo>
getMemoryStatus(): Promise<MemoryStatus>
getScreenOrientation(): Promise<string>
getInfoLinkServerType(): Promise<string>
```

**Download management:**
```typescript
startDownload(url, options): Promise<DownloadId>
// options: { headers, hostVerification }
cancelDownload(downloadId): Promise<void>
setDownloadListener(callback): void
isDownloadInProgress(downloadId): Promise<boolean>
```

**Storage:**
```typescript
listStorages(): Promise<Storage[]>
getStorageCapacityInfo(storagePath): Promise<{total, available}>
```

**App/system control:**
```typescript
exitCurrentApplication(): void   // wb2b.exitApp()
rebootDevice(): void              // wb2b.rebootDevice()
setDeviceVolume(volume): void
getDeviceVolume(): Promise<number>
getRMConfig(): Promise<RMConfig>
getFirmwareVersion(): Promise<string>
sendDiagnosticMessage(msg): void
```

**Network:**
```typescript
addNetworkStatusEventListener(callback): void
getNetworkStatus(): Promise<NetworkStatus>
startUdpStreaming(settings): void
stopUdpStreaming(): void
```

---

## vxt-playback-main Platform Implementations

### Structure
```
src/js/platforms/
├── base/           # Base implementations
├── tizen/          # Samsung Tizen TV
├── tizen-tv/       # Tizen TV specific
├── android/        # Android
├── electron/       # Electron desktop
├── browser/        # Web browser
└── web/            # Web platform
```

### Platform Replacement at Build Time
Platform implementations in `platform-api.js` are replaced with the target platform during Rollup build.

### Required Module Implementations Per Platform
Each platform must implement the following modules:
- `filesystem` - File system
- `html` - DOM/display
- `playTimer` - Playback timer (NaCl or WASM)
- `network` - Network
- `udpListener` - UDP listener
- `utils` - Utilities
- `media` - Media player
- `keyhandler` - Keyboard
- `logger` - Logging

---

## Tizen Platform Specifics

### Tizen Version Builds
```bash
npm run tizen     # Default Tizen
npm run tizen4    # Tizen v4
npm run tizenE    # Tizen E series
```

### Tizen-Specific Features
- `PrintLog`: Custom log function (initialized in VxtPlayback.js)
- Uses Tizen WebAPI (files, network, device)
- NaCl-based PlayTimer (Tizen-exclusive native module)

### Tizen Package Structure
- Cordova-tizen plugin (`libs/local-node-modules/cordova-tizen/`)
- WXT plugins (cordova-plugin-w*)

---

## Electron Platform Specifics

### RM Player Library
```
libs/rmplayer/
├── src/            # RM player source
├── native-modules/ # Native C++ modules (Windows platform events)
├── node16/         # Node 16 compatibility
├── tests/          # Unit tests
└── public/         # Public assets
```

### Electron Build Options
```bash
npm run electron:build         # Default Electron build
npm run electron:start         # Electron dev mode
npm run electron:build:ia32    # 32-bit build
npm run electron:build:win7:ia32  # Legacy Windows 7
npm run electron:build:linux   # Linux build
```

### Electron Resources
```
resources/electron/
└── src/    # Electron-specific source
```

### WASM-based PlayTimer (for Electron)
- `play-timer-wasm` - WASM-based timer (git SSH dependency)
- Electron does not support NaCl → uses WASM instead

---

## Android Platform Specifics

### Cordova Android
- Cordova-Android 13.0.0
- Uses local custom plugins:
  - `cordova-plugin-wb2b` - Base bridge
  - `cordova-plugin-wcontentprovider` - Content provider
  - `cordova-plugin-wsync` - Synchronization
  - `cordova-plugin-wsysteminfo` - System info
  - `cordova-plugin-wwebview` - Web view
  - `cordova-plugin-wzip` - Compression
  - `cordova-plugin-wsecstorage` - Secure storage
  - `cordova-plugin-permissions` - Permissions
  - `cordova-plugin-rmchannel` - RM channel communication

### Android Builds
```bash
npm run android              # Development build
npm run android:production   # Production release
```

### Android Resources
```
resources/android/   # Android-specific resources
vxtplayer.keystore   # Signing keystore
```

---

## BrightSign Platform

### Build
```bash
npm run brightsign:build
```

### Resources
```
resources/brightsign/
└── src/
```

---

## Cordova Plugin List (Local)

```
libs/local-node-modules/
├── cordova-plugin-autoupdate/     # Auto update
├── cordova-plugin-file-transfer/  # File transfer
├── cordova-plugin-inappbrowser/   # In-app browser
├── cordova-plugin-permissions/    # Permission management
├── cordova-plugin-rmchannel/      # RM channel
├── cordova-plugin-wb2b/           # W-to-B bridge
├── cordova-plugin-wcontentprovider/ # Content provider
├── cordova-plugin-wsync/          # Synchronization
├── cordova-plugin-wsysteminfo/    # System info
├── cordova-plugin-wwebview/       # Web view
├── cordova-plugin-wzip/           # Compress/decompress
├── cordova-plugin-wsecstorage/    # Secure storage
├── cordova-tizen/                 # Tizen Cordova
└── redux-partial-subscribe/       # Redux partial subscription
```

---

## CI/CD Pipeline

### GitHub Actions Workflows
```
.github/workflows/
├── release-action.yml          # Main release (S3 upload)
├── release-action-opt.yml      # Optimized release
├── release-for-android-action.yml  # Android release
├── release-for-epaper-action.yml   # E-paper device release
├── release-for-windows-action.yml  # Windows Electron release
├── github-actions.yml          # Test pipeline
└── AwsAccess.yml               # AWS access configuration
```

### E-paper Display Support
- Dedicated mode for e-ink displays
- E-paper containers: 'e-paper0', 'e-paper1'
- Dedicated release workflow: `release-for-epaper-action.yml`
- Redux slice: `ePaper` (included in app-redux.ts)

---

## Environment Variables and Configuration Files

### vxtplayer-main
```
.env                     # Environment variables
.npmrc                   # NPM registry and authentication
settings/                # Platform-specific settings
sonar-project.properties # SonarQube code quality
```

### vxt-playback-main
```
tsconfig.json            # TypeScript configuration
jest.config.js           # Test framework configuration
.eslintrc.js             # ESLint rules
app-cli.js               # Build task orchestrator
scripts/                 # Build automation scripts
submodules/              # Git submodules (play-timer-nacl, play-timer-wasm)
```

---

## PlayTimer Implementation by Platform

| Platform | Timer Implementation |
|----------|---------------------|
| Tizen | play-timer-nacl (NaCl native) |
| Electron | play-timer-wasm (WASM) |
| Android | Platform-specific implementation |
| Browser/Web | Software implementation |

PlayTimerController provides a uniform interface regardless of platform:
```javascript
playTimer.isReady()
playTimer.start(syncGroupId, timeServerUrl, ScheduleManager)
playTimer.stop()
playTimer.setEnableLog()
// Actual platform implementation injected at build time
```
