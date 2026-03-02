# vxtplayer-main 모듈 상세 참조

## Redux 아키텍처

### app-store.ts
Redux store 설정 파일.

- `epicMiddleware`: Redux-Observable 비동기 처리
- 미들웨어 스택 순서: `[loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]`
- `loggerMiddleware`: 액션 dispatch 시 logUuid 메타데이터 첨부
- `injectReducer(key, reducer)`: 동적 리듀서 주입 지원
- 개발 환경에서 Redux DevTools 활성화

### app-redux.ts
루트 리듀서 및 루트 에픽 조합 파일.

**rootReducer 슬라이스 목록:**
- `bgAudio` - 백그라운드 오디오
- `device` - 디바이스 설정
- `downloader` - 콘텐츠 다운로드
- `entities` - 스케줄 엔티티
- `events` - 시스템 이벤트
- `logger` - 로그
- `message` - 메시지 표시
- `proofOfPlay` - 재생 증적
- `realtimeAsset` - 실시간 에셋
- `scheduleMetadata` - 스케줄 메타데이터
- `keepAliveMetadata` - Keep-alive 상태
- `storages` - 스토리지
- `watchDog` - 와치독
- `vxAgentDevice` - VX Agent 디바이스
- `wschedulerCommunication` - W-Scheduler 통신
- `vxServerCommunication` - VX 서버 통신
- `appControl` - 앱 제어
- `uiElements` - UI 요소
- `widgetSubscriptions` - 위젯 구독
- `playbackCommunication` - 플레이백 통신
- `ePaper` - 전자잉크 디스플레이
- `diagnostic` - 진단
- `nsn` - NSN
- `nsnServerCommunication` - NSN 서버 통신
- `weather` - 날씨
- `shuffle` - 셔플
- `lifespan` - 앱 수명주기

**rootEpic 포함 에픽:**
- deleteAssetEpic, downloaderEpic, realtimeAssetEpic
- vxServerCommunicationEpic 등

### actions.ts
글로벌 액션 크리에이터 (`createAction` 기반).

```typescript
// 주요 액션 목록
uncaughtErrorOccurred              // 전역 에러 처리
appVisibilitySwitchedToBackground  // 앱 라이프사이클
screenOrientationReceived          // 화면 방향 변경
contentScheduleReceived            // 콘텐츠 스케줄 수신
contentScheduleClearingRequested   // 스케줄 초기화 요청
defaultContentReceived             // 기본 콘텐츠 수신
defaultImageReceived               // 기본 이미지 수신
defaultContentChanged              // 기본 콘텐츠 변경
deviceTagsReceived                 // 디바이스 태그 수신
screenTagsReceived                 // 화면 태그 수신
triggeredByPlans                   // 플랜 트리거
playingStorageConnected            // 스토리지 연결
storageRemoved                     // 스토리지 제거
storageSelected                    // 스토리지 선택

// 헬퍼 함수
assocDispatchTime()    // 디스패치 타임스탬프 첨부
dispatchAddLogUuid()   // 로그 UUID 첨부
```

---

## 핵심 모듈

### playback-communication 모듈
**경로:** `src/modules/playback-communication/`

vxtplayer-main과 vxt-playback-main 사이의 통신 브릿지.

**Redux 상태:**
```typescript
{
  serialEvent: undefined,
  platformApiEventResponse: undefined,
  playerWineEvent: undefined
}
```

**액션:**
- `updateSerialEvent`: 시리얼 이벤트 업데이트
- `updatePlatformApiEventResponse`: 플랫폼 API 응답 업데이트
- `updatePlayerWineEvent`: Wine 플레이어 이벤트 업데이트

---

### device 모듈
**경로:** `src/modules/device/`

**상태 구조:**
```typescript
{
  // 네트워크
  mac, ip, networkStatus, connectionStatus,
  subnetMask, broadcastIp,

  // 디바이스 정보
  deviceName, deviceModel, serialNumber,
  screenSize, screenResolution,

  // 서버 설정
  magicINFOServer, edgeServers, downloadServer,
  vxServerUrl, adServer,

  // 화면 설정
  screenOrientation, customResolution,
  displayMode, panelState, videoPreParingTime,

  // 태그
  screenTags, mediaTags, variableTags,

  // 조직
  organizationId, organizationName,
  workspaceId, workspaceName,

  // 기능
  screenWall, popupSchedule, emergency,
  hmacSecret, masterScreenId
}
```

**40+ 리듀서 액션:**
- `edgeServersReceived`, `magicInfoServerReceived`, `networkInfoReceived`
- `deviceModelReceived`, `screenSizeReceived`, `screenResolutionReceived`
- `displayModeReceived`, `adServerReceived`, `panelStateReceived`
- `videoPreparingTimeQueueReceived`, `maxVideoPreparingTimeReceived`

---

### watchdog 모듈
**경로:** `src/modules/watchdog/`

**상태:**
```typescript
{
  reloadCount: number,    // 재로드 횟수
  time: timestamp,        // 마지막 watchdog 시간
  isHidden?: boolean,
  exit?: timestamp,
  reload?: timestamp,
  update?: timestamp,
  cacheCleared?: boolean
}
```

**서비스 로직 (`watchdog-service.ts`):**
- `CLEARLOCALSTORAGE_TIME`: 30분 내 5회 이상 → 로컬스토리지 초기화
- `RESET_IGNORE_TIME`: 12시간 후 카운터 리셋
- `CALLTIME_LIMIT`: 5회 제한
- `reloadAppFromWatchdog()`: 앱 재로드 트리거
- `isIgnoreWathDog()`: 무시 여부 판단
- `processWatchDogFired()`: 재로드/스토리지 초기화 결정 로직

---

### downloader-proposal 모듈
**경로:** `src/modules/downloader-proposal/`

**공통 상태:**
```typescript
{
  remainingTime: 0,
  downloadIds: Array<{
    fileId, filename, filesize, downloadId, dataSavingSize
  }>,
  bandwidthLimit: 0,
  isNsnDownload: false
}
```

**다운로드 타입 상수 (`DOWNLOAD_TYPE`):**
- `ON_NEW_SCHEDULE` - 새 스케줄 시 다운로드
- `ON_NEW_TAGS` - 새 태그 시 다운로드
- `ON_NEW_DEFAULT_CONTENT` - 기본 콘텐츠 다운로드
- `ON_NEW_DEFAULT_IMAGE` - 기본 이미지 다운로드

**다운로드 상태 (`DOWNLOAD_STATUS`):**
- `NOT_AVAILABLE`, `START`, `DOWNLOADING`, `COMPLETED`
- `FAILED`, `ABORTED`, `HASH_ERROR`, `EMPTY`, `PAUSED`

**에러 코드 (`DOWNLOAD_ERROR_CODE`):**
- `NOT_ENOUGH_STORAGE`: 2000
- `API_ERROR`: 2001
- `NEED_TO_DELETE_CURRENT_SCHEDULE`: 2002
- `PLATFORM_ERROR`: 2003
- `FAIL_TO_DOWNLOAD_CONTENT`: 2999

**다운로드 완료 콜백:**
- `onContentScheduleFilesDownloadCompleted`
- `onPopupSyncScheduleFilesDownloadCompleted`
- `onEmergencyScheduleFilesDownloadCompleted`
- `onContentScheduleFileEmptyError`

**초기화:**
- `createAssetsDirectories()`: MAGICINFO_DIRECTORY_PATH 및 ASSETS 디렉토리 생성

---

### proof-of-play 모듈
**경로:** `src/modules/proof-of-play/`

**상태:**
```typescript
{
  duration: 30,         // PoP 지속 시간 (초)
  size: 50,             // PoP 크기
  name: 'PopAllowedType',
  value: ['ALL']
}
```

**액션:**
- `proofOfPlaySettingsReceived`: 서버에서 PopManagement 설정 파싱 ("duration;size" 형식)

**수집 함수 (`collect-pop.ts` - Ramda 파이프 기반):**
- `writeGeneralPopEntry`: 일반 PoP 항목 기록
- `writeMediaPopEntry`: 미디어 PoP 항목 기록
- `writeWiNEPopEntry`: Wine 미디어 PoP 항목
- `writePlaneCheckPopEntry`: Plan 체크 PoP 항목

**업로드 함수 (`upload-pop.ts`):**
- `exportPop`: PoP 데이터 내보내기
- `uploadPopToMagicInfoServer`: MagicINFO 서버에 업로드
- `uploadPopMediaToMagicInfoServer`: 미디어 PoP 업로드

---

### vx-agent 모듈
**경로:** `src/modules/vx-agent/`

#### vx-agent-device (하위 모듈)
VX Agent 디바이스 설정 및 등록 상태.

**상태 구조:**
```typescript
{
  // 연결
  connectionStatus,
  bootStrap: boolean,

  // 등록
  justEnrolled: boolean,
  activation status,
  deleteDeviceStatus,

  // 보안
  useSecureKey, secureKeyInitialized, hmacSecret,

  // VX 서버
  url, contentUrl, sns, art, adUrls,
  mqttUrl, timeServerUrl,

  // 디바이스 설정 (value/result 쌍)
  deviceName, deviceType, channel,
  screenTag, mediaTags, variableTags,
  KernelTimezoneArea, KernelTimezone,
  logMnt, proofOfPlayMnt, planInformation
}
```

**승인 상태 타입 변환:**
- `unregistered` → 0
- `activated` → 1
- `deactivated` → 2
- `connection-fail` → 3

**13개 리듀서 액션:**
- `bootstrapStateChanged`, `connectionStateChanged`
- `deviceNameChanged`, `deviceSettingsUpdated`
- `deviceTypeInitialized`, `vxServerInfoInitialized`
- `screenActivationStatusReceived`, `deleteDeviceStatusReceived`

#### vx-server-communication (하위 모듈)
VX Server API 통신 상태.

**상태:**
```typescript
{
  accessToken, refreshToken,
  organizationId,
  scheduleData, scheduleDataCompress,
  messageId,
  mo: {  // message object - 에러 핸들링 포함
    ...
  }
}
```

**액션:**
- `apiResponseReceived`: API 응답 데이터 업데이트
- `apiResponseReceivedScheduleData`: 스케줄 데이터 업데이트 (compress 플래그 포함)
- `errorResponse`: API 에러 처리
- `messageIdReceived`: 메시지 ID 업데이트

**에픽 (`vx-server-communication-epic.js`):**
- WebSocket 연결 (sendWebsocketMessage)
- 스케줄링 및 폴링
- 인증 토큰 관리
- 디바이스 등록 및 승인 워크플로우

---

## UI 컴포넌트 (src/components/)

### app.js (메인 앱)
**경로:** `src/main/app.js`

**E-Paper 모드 렌더링:**
- memoryMonitorComponent
- e-paper 컨테이너 2개 (id: 'e-paper0', 'e-paper1')
- playerContainer, loggerComponent, pairingCodeWithQrComponent

**일반 모드 렌더링:**
- memoryMonitorComponent
- playerContainer
- frontLayerComponent
- bgAudioContainer, messageContainer
- loggerComponent
- pairingCodeWithQrComponent
- exitPopupComponent
- playerMenuComponent

### 주요 컴포넌트 목록

| 컴포넌트 | 역할 |
|---------|------|
| `player/` | 메인 비디오 플레이어 UI |
| `player-menu/` | 플레이어 제어 메뉴 |
| `message/` | 알림/메시지 표시 |
| `logger/` | 로그 뷰어/디버거 UI |
| `settings/` | 설정 메뉴 |
| `pairing-code/` | QR 포함 디바이스 페어링 코드 |
| `accessibility/` | 접근성 기능 |
| `channel-banner/` | 채널 이름/정보 배너 |
| `background-audio/` | 백그라운드 오디오 |
| `info-window/` | 정보 표시 창 |
| `server-settings/` | 서버 설정 UI |
| `memory-monitor/` | 메모리 사용량 모니터 |
| `exit-popup/` | 종료 확인 팝업 |

---

## 유틸리티 (src/utils/)

### platform/ 디렉토리
플랫폼별 구현체 (Android 예시).

**파일 작업:**
- `listFiles`, `resolvePath`, `doesFileExist`
- `copyFile`, `moveFile`
- `createDirectory`, `createFile`, `deleteDirectory`, `deleteFile`
- `readFileAsText`, `readFileAsBase64`, `readFileAsBytes`
- `saveDataAsFile`, `saveBytesAsFile`, `appendDataToFile`
- `getDirectorySize`, `getFileSizeFromPath`
- `openFileStream`: 스트림 기반 파일 I/O (close() 포함)

**아카이브:**
- `addFilesToArchive`, `extractArchiveTo`, `extractArchiveToUsingFileObject`

**디바이스 정보:**
- `getMacAddress`, `getSerialNumber`, `getIpAddress`
- `getSubnetMask`, `getBroadcastIp`
- `getDeviceModel`, `getDeviceType`, `getScreenSize`, `getScreenResolution`
- `getMemoryInfo`, `getMemoryStatus`
- `getScreenOrientation`, `getInfoLinkServerType`

**다운로드:**
- `startDownload`: 헤더 및 호스트 검증 포함 다운로드 요청 생성
- `cancelDownload`: 활성 다운로드 취소
- `setDownloadListener`: 다운로드 진행률 리스너 등록
- `isDownloadInProgress`: 다운로드 상태 확인

**스토리지:**
- `listStorages`: USB 스토리지 목록
- `getStorageCapacityInfo`: 스토리지 용량 정보

**앱 제어:**
- `exitCurrentApplication`: wb2b.exitApp()로 앱 종료
- `rebootDevice`: wb2b.rebootDevice()로 재부팅
- `setDeviceVolume`, `getDeviceVolume`: 볼륨 제어

**네트워크:**
- `addNetworkStatusEventListener`: 네트워크 상태 변경 등록
- `getNetworkStatus`: 현재 네트워크 상태 조회
- `startUdpStreaming`, `stopUdpStreaming`: UDP 스트리밍

---

## 빌드 스크립트

```bash
# 개발
npm start                    # Vite 개발 서버
npm run lint                 # ESLint 검사
npm run prettier             # 코드 포맷

# 플랫폼 빌드
npm run tizen                # Tizen TV 빌드 및 배포
npm run tizen4               # Tizen v4
npm run tizenE               # Tizen E 시리즈
npm run android              # Android 빌드
npm run brightsign:build     # BrightSign
npm run electron:build       # Electron 앱
npm run electron:start       # Electron 개발 모드

# 테스트
npm test                     # Jest 단위 테스트
npm test:coverage            # 커버리지 포함
npm run e2e                  # E2E 테스트
```
