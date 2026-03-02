# 플랫폼별 구현 및 빌드 참조

## 지원 플랫폼 목록

| 플랫폼 | 상태 | 디렉토리 |
|--------|------|---------|
| Tizen (Samsung TV) | 주력/안정 | `src/utils/platform/tizen/` |
| Android | 실험적 | `src/utils/platform/android/` |
| Electron (Desktop) | 실험적 | `src/utils/platform/electron/` |
| Web/Browser | 제한적 | `src/utils/platform/web/` |
| BrightSign | 지원 | `resources/brightsign/` |

---

## vxtplayer-main 플랫폼 추상화

### 구조
```
src/utils/platform/
├── android/
│   └── index.ts    # Android 플랫폼 API 파사드
├── electron/
│   └── index.ts    # Electron 플랫폼 API 파사드
├── tizen/
│   └── index.ts    # Tizen 플랫폼 API 파사드
└── web/
    └── index.ts    # Web 플랫폼 API 파사드
```

### Android 플랫폼 API (가장 상세한 구현)
모든 함수는 `handleError` / `handleErrorAsync` 데코레이터로 래핑됨.

**파일 작업:**
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
openFileStream(path): {read(), close()}   // 스트림 기반
```

**아카이브:**
```typescript
addFilesToArchive(files, archivePath): Promise<void>
extractArchiveTo(archivePath, destPath): Promise<void>
extractArchiveToUsingFileObject(archiveFile, destPath): Promise<void>
```

**디바이스 정보:**
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

**다운로드 관리:**
```typescript
startDownload(url, options): Promise<DownloadId>
// options: { headers, hostVerification }
cancelDownload(downloadId): Promise<void>
setDownloadListener(callback): void
isDownloadInProgress(downloadId): Promise<boolean>
```

**스토리지:**
```typescript
listStorages(): Promise<Storage[]>
getStorageCapacityInfo(storagePath): Promise<{total, available}>
```

**앱/시스템 제어:**
```typescript
exitCurrentApplication(): void   // wb2b.exitApp()
rebootDevice(): void              // wb2b.rebootDevice()
setDeviceVolume(volume): void
getDeviceVolume(): Promise<number>
getRMConfig(): Promise<RMConfig>
getFirmwareVersion(): Promise<string>
sendDiagnosticMessage(msg): void
```

**네트워크:**
```typescript
addNetworkStatusEventListener(callback): void
getNetworkStatus(): Promise<NetworkStatus>
startUdpStreaming(settings): void
stopUdpStreaming(): void
```

---

## vxt-playback-main 플랫폼 구현

### 구조
```
src/js/platforms/
├── base/           # 기반 구현체
├── tizen/          # Samsung Tizen TV
├── tizen-tv/       # Tizen TV 전용
├── android/        # Android
├── electron/       # Electron 데스크톱
├── browser/        # 웹 브라우저
└── web/            # 웹 플랫폼
```

### 빌드 시 플랫폼 교체
`platform-api.js`의 플랫폼 구현체는 Rollup 빌드 시 타겟 플랫폼으로 교체됨.

### 플랫폼별 모듈 구현 목록
각 플랫폼이 구현해야 하는 모듈:
- `filesystem` - 파일시스템
- `html` - DOM/디스플레이
- `playTimer` - 재생 타이머 (NaCl 또는 WASM)
- `network` - 네트워크
- `udpListener` - UDP 리스너
- `utils` - 유틸리티
- `media` - 미디어 플레이어
- `keyhandler` - 키보드
- `logger` - 로깅

---

## Tizen 플랫폼 특이사항

### Tizen 버전별 빌드
```bash
npm run tizen     # 기본 Tizen
npm run tizen4    # Tizen v4
npm run tizenE    # Tizen E 시리즈
```

### Tizen 특화 기능
- `PrintLog`: 커스텀 로그 함수 (VxtPlayback.js에서 초기화)
- Tizen WebAPI 활용 (파일, 네트워크, 디바이스)
- NaCl 기반 PlayTimer (tizen 전용 네이티브 모듈)

### Tizen 패키지 구조
- Cordova-tizen 플러그인 (`libs/local-node-modules/cordova-tizen/`)
- WXT 플러그인들 (cordova-plugin-w*)

---

## Electron 플랫폼 특이사항

### RM Player 라이브러리
```
libs/rmplayer/
├── src/            # RM 플레이어 소스
├── native-modules/ # 네이티브 C++ 모듈 (Windows 플랫폼 이벤트)
├── node16/         # Node 16 호환성
├── tests/          # 단위 테스트
└── public/         # 공개 에셋
```

### Electron 빌드 옵션
```bash
npm run electron:build         # 기본 Electron 빌드
npm run electron:start         # Electron 개발 모드
npm run electron:build:ia32    # 32비트
npm run electron:build:win7:ia32  # Windows 7 레거시
npm run electron:build:linux   # Linux 빌드
```

### Electron 리소스
```
resources/electron/
└── src/    # Electron 전용 소스
```

### WASM 기반 PlayTimer (Electron용)
- `play-timer-wasm` - WASM 기반 타이머 (git SSH 의존성)
- Electron은 NaCl 미지원 → WASM 사용

---

## Android 플랫폼 특이사항

### Cordova Android
- Cordova-Android 13.0.0
- 로컬 커스텀 플러그인 사용:
  - `cordova-plugin-wb2b` - 기본 브릿지
  - `cordova-plugin-wcontentprovider` - 콘텐츠 프로바이더
  - `cordova-plugin-wsync` - 동기화
  - `cordova-plugin-wsysteminfo` - 시스템 정보
  - `cordova-plugin-wwebview` - 웹뷰
  - `cordova-plugin-wzip` - 압축
  - `cordova-plugin-wsecstorage` - 보안 스토리지
  - `cordova-plugin-permissions` - 권한
  - `cordova-plugin-rmchannel` - RM 채널 통신

### Android 빌드
```bash
npm run android              # 개발 빌드
npm run android:production   # 프로덕션 릴리즈
```

### Android 리소스
```
resources/android/   # Android 전용 리소스
vxtplayer.keystore   # 서명 키스토어
```

---

## BrightSign 플랫폼

### 빌드
```bash
npm run brightsign:build
```

### 리소스
```
resources/brightsign/
└── src/
```

---

## Cordova 플러그인 목록 (로컬)

```
libs/local-node-modules/
├── cordova-plugin-autoupdate/     # 자동 업데이트
├── cordova-plugin-file-transfer/  # 파일 전송
├── cordova-plugin-inappbrowser/   # 인앱 브라우저
├── cordova-plugin-permissions/    # 권한 관리
├── cordova-plugin-rmchannel/      # RM 채널
├── cordova-plugin-wb2b/           # W-to-B 브릿지
├── cordova-plugin-wcontentprovider/ # 콘텐츠 프로바이더
├── cordova-plugin-wsync/          # 동기화
├── cordova-plugin-wsysteminfo/    # 시스템 정보
├── cordova-plugin-wwebview/       # 웹뷰
├── cordova-plugin-wzip/           # 압축/해제
├── cordova-plugin-wsecstorage/    # 보안 스토리지
├── cordova-tizen/                 # Tizen Cordova
└── redux-partial-subscribe/       # Redux 부분 구독
```

---

## CI/CD 파이프라인

### GitHub Actions 워크플로우
```
.github/workflows/
├── release-action.yml          # 메인 릴리즈 (S3 업로드)
├── release-action-opt.yml      # 최적화 릴리즈
├── release-for-android-action.yml  # Android 릴리즈
├── release-for-epaper-action.yml   # E-paper 디바이스 릴리즈
├── release-for-windows-action.yml  # Windows Electron 릴리즈
├── github-actions.yml          # 테스트 파이프라인
└── AwsAccess.yml               # AWS 접근 설정
```

### E-paper 디스플레이 지원
- 전자잉크 디스플레이 전용 모드
- E-paper 컨테이너: 'e-paper0', 'e-paper1'
- 전용 릴리즈 워크플로우: `release-for-epaper-action.yml`
- Redux 슬라이스: `ePaper` (app-redux.ts에 포함)

---

## 환경 변수 및 설정 파일

### vxtplayer-main
```
.env                     # 환경 변수
.npmrc                   # NPM 레지스트리 및 인증
settings/                # 플랫폼별 설정
sonar-project.properties # SonarQube 코드 품질
```

### vxt-playback-main
```
tsconfig.json            # TypeScript 설정
jest.config.js           # 테스트 프레임워크 설정
.eslintrc.js             # ESLint 규칙
app-cli.js               # 빌드 태스크 오케스트레이터
scripts/                 # 빌드 자동화 스크립트
submodules/              # Git 서브모듈 (play-timer-nacl, play-timer-wasm)
```

---

## 플랫폼별 PlayTimer 구현

| 플랫폼 | 타이머 구현 |
|--------|-----------|
| Tizen | play-timer-nacl (NaCl 네이티브) |
| Electron | play-timer-wasm (WASM) |
| Android | 플랫폼 구현체 |
| Browser/Web | 소프트웨어 구현 |

PlayTimerController는 플랫폼과 무관하게 동일한 인터페이스 제공:
```javascript
playTimer.isReady()
playTimer.start(syncGroupId, timeServerUrl, ScheduleManager)
playTimer.stop()
playTimer.setEnableLog()
// 각 플랫폼의 실제 구현이 빌드 시 주입됨
```
