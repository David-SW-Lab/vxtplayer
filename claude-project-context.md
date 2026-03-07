# VXTPlayer 프로젝트 전체 컨텍스트
> Claude.ai Projects 업로드용 통합 문서
> 생성일: 2026-03-07

---

# 1. 프로젝트 개요 및 아키텍처

## 프로젝트 메타데이터

| 항목 | 값 |
|------|-----|
| 제작사 | Samsung Electronics, Visual Display Division |
| 연락처 | vxt@samsung.com |
| 버전 | 3.1.36 |
| 라이선스 | Apache-2.0 |
| Node.js | 18.12.1 (vxtplayer-main), 16.14.0 (vxt-playback-main) |

## 두 레포의 관계

```
┌─────────────────────────────────────────────────────────────┐
│                      vxtplayer-main                         │
│   (메인 앱 - 서버 통신, 스케줄 관리, 다운로드, UI 오케스트레이션)  │
│                                                             │
│  VX Server ──► vx-agent ──► Redux Store                    │
│  MagicINFO ──► downloader ──► (콘텐츠 다운로드)              │
│                    │                                        │
│          playback-communication (모듈)                       │
│                    │ assignJob() / setFrameSchedule()        │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼  (@vxt/playback npm 패키지)
┌─────────────────────────────────────────────────────────────┐
│                    vxt-playback-main                        │
│   (플레이백 엔진 - 실제 멀티미디어 렌더링 담당)                   │
│                                                             │
│  PlaybackJobHandler ──► PlaybackPageManager                 │
│  PlayTimerController ──► Page ──► Element ──► DOM 렌더링    │
│  WatchDog (헬스 모니터링)                                    │
└─────────────────────────────────────────────────────────────┘
```

**통신 흐름:**
```
vxtplayer → Redux state → CustomEvent (DOM) → vxt-playback → CustomEvent → Redux
```

## 기술 스택

### vxtplayer-main
| 범주 | 기술 |
|------|-----|
| 언어 | TypeScript 4.9.5 (JS 혼재) |
| 상태관리 | Redux 4.2.1 + Redux-Observable 1.2.0 (RxJS) |
| 빌드 | Vite 5.0.12 |
| 하이브리드 | Apache Cordova 12.0.0 |
| 비동기 | RxJS 6.6.7 |
| 함수형 | Ramda 0.28.0 |
| 테스트 | Jest 29.7.0 |

### vxt-playback-main
| 범주 | 기술 |
|------|-----|
| 언어 | JavaScript ES2015 + TypeScript 5.0.4 |
| 빌드 | Rollup 3.29.5 |
| 플랫폼 | @supernova/wine-api 2.0.0 |
| 타이머 | play-timer-nacl / play-timer-wasm (NaCl/WASM 네이티브) |
| 테스트 | Jest 29.7.0 (175개 테스트 파일) |

## 지원 플랫폼

| 플랫폼 | 상태 |
|--------|------|
| Tizen (Samsung TV) 4.x, E 시리즈 | 주력/안정 |
| Android (Cordova) | 실험적 |
| Electron (Windows/Linux) | 실험적 |
| BrightSign | 지원 |
| Web/Browser | 개발/디버그 전용 |

## 전체 데이터 흐름

```
1. 부팅/초기화
   - app.js: DOM 생성 (e-paper/normal 모드 분기)
   - Redux store 초기화
   - VX Agent 연결 및 디바이스 등록

2. 스케줄 수신
   - VX Server → vx-server-communication-epic.js
   - scheduleData → contentScheduleReceived 액션
   - downloader 모듈: 필요 에셋 파일 다운로드 시작

3. 다운로드 완료
   - onContentScheduleFilesDownloadCompleted 콜백
   - playback-communication 모듈 → @vxt/playback API 호출

4. 플레이백 엔진 처리
   - PlaybackJobHandler.setFrameSchedule(data)
   - ResourceManager.loadResourcesFromScheduleData()
   - PlaybackPageManager.reload()

5. 렌더링
   - Page.load() → Element.load() → DOM 삽입
   - PlayTimerController.start()
   - 타이머 콜백 → 페이지 전환

6. 모니터링
   - WatchDog: 0 틱 감지(60초), 스케줄 없음(60초)
   - vxtplayer WatchDog: reloadCount, 로컬스토리지 초기화

7. Proof of Play
   - Element.popPlayFinished() → collect-pop.ts
   - upload-pop.ts → MagicINFO 서버 업로드
```

---

# 2. vxtplayer-main 모듈 상세

## Redux 아키텍처

### 루트 리듀서 슬라이스 (app-redux.ts)
```
bgAudio, device, downloader, entities, events, logger, message,
proofOfPlay, realtimeAsset, scheduleMetadata, keepAliveMetadata,
storages, watchDog, vxAgentDevice, wschedulerCommunication,
vxServerCommunication, appControl, uiElements, widgetSubscriptions,
playbackCommunication, ePaper, diagnostic, nsn, nsnServerCommunication,
weather, shuffle, lifespan
```

### 주요 Redux 액션 (actions.ts)
```typescript
contentScheduleReceived         // 콘텐츠 스케줄 수신
contentScheduleClearingRequested // 스케줄 초기화 요청
defaultContentReceived           // 기본 콘텐츠 수신
deviceTagsReceived               // 디바이스 태그 수신
screenTagsReceived               // 화면 태그 수신
triggeredByPlans                 // 플랜 트리거
playingStorageConnected          // 스토리지 연결
```

### middleware 순서 (app-store.ts L93–98)
```js
// 현재 상태 (버그 - P0)
middleware: [loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]
// 올바른 순서
middleware: [loggerMiddleware, subscribeMiddleware, epicMiddleware, loggerMiddlewareEnd]
```

## 핵심 모듈

### playback-communication
vxtplayer-main과 vxt-playback-main 사이의 통신 브릿지.
```js
jobHandler.setFrameSchedule(frameScheduleData)
jobHandler.assignJob(jobData)
jobHandler.setVariableTags(data)
jobHandler.updateDeviceInfo(data)
```

### device 모듈 (40+ 리듀서 액션)
```typescript
{
  mac, ip, networkStatus, connectionStatus,
  deviceName, deviceModel, serialNumber,
  screenSize, screenResolution,
  magicINFOServer, edgeServers, vxServerUrl,
  screenOrientation, customResolution,
  screenTags, mediaTags, variableTags,
  organizationId, workspaceId,
  screenWall, popupSchedule, emergency,
  hmacSecret, masterScreenId
}
```

### watchdog 모듈
- 30분 내 5회 이상 재로드 → 로컬스토리지 초기화
- 12시간 후 카운터 리셋
- 5회 제한 (CALLTIME_LIMIT)

### downloader-proposal 모듈
```
DOWNLOAD_STATUS: NOT_AVAILABLE | START | DOWNLOADING | COMPLETED | FAILED | ABORTED | HASH_ERROR | EMPTY | PAUSED
DOWNLOAD_ERROR_CODE: NOT_ENOUGH_STORAGE(2000) | API_ERROR(2001) | PLATFORM_ERROR(2003) | FAIL_TO_DOWNLOAD_CONTENT(2999)
```

### proof-of-play 모듈
```typescript
// 수집 (Ramda 파이프)
writeGeneralPopEntry, writeMediaPopEntry, writeWiNEPopEntry, writePlaneCheckPopEntry
// 업로드
uploadPopToMagicInfoServer, uploadPopMediaToMagicInfoServer
```

### vx-agent 모듈 (vx-agent-device)
```typescript
// 승인 상태
unregistered(0) | activated(1) | deactivated(2) | connection-fail(3)
// 13개 리듀서 액션: bootstrapStateChanged, connectionStateChanged, deviceSettingsUpdated 등
```

## 주요 UI 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `player-container.js` | 메인 플레이어 UI (1,667줄 God Component — P1 리팩토링 필요) |
| `message-container.js` | 알림/메시지 표시 |
| `logger/` | 로그 뷰어/디버거 UI |
| `pairing-code/` | QR 포함 디바이스 페어링 |
| `memory-monitor/` | 메모리 사용량 모니터 |

---

# 3. vxt-playback-main 엔진 상세

## 컴포넌트 구조

```
VxtPlayback (진입점)
  ├── PlaybackPageManager (싱글톤, 1,780줄) — 페이지 라이프사이클
  │   ├── Page (더블 버퍼링 레이어 0/1)
  │   │   └── Element (DOM 요소)
  │   │       └── Content (미디어 콘텐츠)
  ├── PlaybackJobHandler (싱글톤) — 잡 처리
  ├── PlayTimerController (싱글톤) — NaCl/WASM 타이머
  ├── ResourceManager (싱글톤) — 에셋 로딩
  └── WatchDog (싱글톤) — 헬스 모니터링
```

## DOM 레이어 구조 (z-index)

```
10000 - 로딩 레이어
 2001 - 글로벌 전면 페이지 레이어 1
 2000 - 글로벌 전면 페이지 레이어 0
 1001 - 로컬 콘텐츠 페이지 레이어 1
 1000 - 로컬 콘텐츠 페이지 레이어 0
  801 - 글로벌 배경 페이지 레이어 1
  800 - 글로벌 배경 페이지 레이어 0
  101 - 배경 레이어 1
  100 - 배경 레이어 0
```

## PlaybackJobHandler — assignJob 잡 타입

```js
'frameschedule'            // 프레임 스케줄 데이터
'variabletags'             // 변수 태그 업데이트
'realtimeassetdownload'    // 에셋 다운로드 상태
'updatedeviceinfo'         // 디바이스 정보 업데이트
'updatedviceinfo'          // 위와 동일 (오타 버전 호환)
'customvideopreparingtime' // 비디오 준비 타이밍
'updatescreenwall'         // 멀티스크린 업데이트
'accesstoken'              // 액세스 토큰
'enabletimerlog'           // 타이머 로그 활성화
'activate' / 'deactivate'  // 페이지 활성화
'stopplayer'               // 재생 정지
```

## WatchDog 모니터링 항목

1. **제로 타임틱 감지** — 60초 이상 0 틱 지속 시 재로드
2. **오버플로 타임틱 감지** — 전체 지속 시간 초과 60초 지속 시 재로드
3. **빈 프레임 스케줄 감지** — 60초 이상 스케줄 미발행 시 재로드
4. **미디어 상태 이슈** — 부모 요소 null 감지

## 지원 콘텐츠 타입

`Image, Video, Sound, LFD, DLK(DataLink), FtpCifs, VX`

## 지원 비주얼 이펙트

`Blind, Curtain, Zoom, Stripe, Swiss, Turn, Corner, BlackDissolve, TextTypingCSS`

## 지원 요소 타입

```
Image, Audio, Shape, Color, HTML, MediaSlide, DataLink,
Clock (Analog/Digital),
Widgets: MenuBoardWidget, NavigationWidget, ExpansionWidget, RotateWidget
```

---

# 4. API 인터페이스 및 통신 프로토콜

## frameSchedule 데이터 구조

```javascript
{
  scheduleId: string,
  scheduleVersion: string,
  channel: string,
  frameSchedules: [
    {
      pageId: string,
      pageName: string,
      duration: number,  // ms
      effects: [...],
      elements: [
        {
          elementId: string,
          elementType: string,  // 'image' | 'video' | 'html' | 'widget' | ...
          zIndex: number,
          position: { x, y, width, height },
          content: { ... }
        }
      ]
    }
  ],
  preloadItems: {
    fontFileList: [...],
    cssFileList: [...]
  }
}
```

## 공개 API (window.playerApi)

```javascript
// Content API
window.playerApi.content.movePage(name)
window.playerApi.content.getPage(pageId)
window.playerApi.content.getAllPageNames()

// Device API
window.playerApi.device.getProperty(name)
// 지원 속성: PLAYER_VERSION, FIRMWARE_VERSION, VARIABLE_TAG,
// MIS_IP, MACADDRESS, IPADDRESS, RESOLUTION, ORIENTATION,
// SNS_ACCESS_TOKEN, VXT_SERVER_URL, DEVICE_NAME,
// VIDEO_PRE_PARING_TIME, PLAYLIST_META_DATA

// Event API
window.playerApi.event.publish(type, subType, data)
window.playerApi.event.subscribe(type, subType, callback)
window.playerApi.event.unsubscribeAll()

// Utility API
window.playerApi.utility.log(message)
```

## DOM CustomEvent 통신

```javascript
// vxt-playback → vxtplayer
'wplayer:initialized'   // 초기화 완료 ({ version })
'wplayer:watchDogFired' // 재로드 필요 ({ reason })

// vxtplayer → vxt-playback
'playerWineEvent'       // Wine API 이벤트
```

## Wine API 채널

```javascript
'keyHandler'   // 키보드 입력
'platformApi'  // 플랫폼 API
'userSettings' // 사용자 환경설정
'playerApi'    // 플레이어 내부 API
```

## VX 서버 통신

- 방식: WebSocket + HTTP REST + MQTT
- 인증: `accessToken` / `refreshToken` + HMAC 시크릿
- 스케줄 데이터: LZMA 압축 지원 (`scheduleDataCompress: boolean`)

---

# 5. 플랫폼별 특이사항

## Tizen (주력)
- PlayTimer: NaCl 네이티브 (`play-timer-nacl`)
- 빌드: `npm run tizen` / `npm run tizen4` / `npm run tizenE`
- Cordova-tizen 플러그인 사용

## Electron
- PlayTimer: WASM (`play-timer-wasm`) — NaCl 미지원
- RM Player 라이브러리 (`libs/rmplayer/`)
- 빌드: `npm run electron:build`

## Android
- Cordova-Android 13.0.0
- 로컬 커스텀 플러그인: wb2b, wcontentprovider, wsync, wsysteminfo, wwebview, wzip
- 빌드: `npm run android:production`

## 플랫폼별 PlayTimer

| 플랫폼 | 구현 |
|--------|------|
| Tizen | play-timer-nacl (NaCl) |
| Electron | play-timer-wasm (WASM) |
| Android | 플랫폼 구현체 |
| Browser/Web | 소프트웨어 구현 |

---

# 6. 코드 이슈 분석

## P0 — 즉시 수정

### middleware 순서 역전 (app-store.ts L93–98)
```js
// 잘못됨 (현재)
middleware: [loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]
// 올바름
middleware: [loggerMiddleware, subscribeMiddleware, epicMiddleware, loggerMiddlewareEnd]
```
**영향:** 모든 Redux action 로그가 `E → B` 역순으로 찍힘

## P1 — 중요

### kernel-time-monitor.js 오타 및 임계값 오류
```js
// 현재 (잘못됨)
const UNAPPROPRIATE_TIME = 60000;  // 1970-01-01 00:01 이후면 통과 — 의미 없음
// 수정
const INAPPROPRIATE_TIME = Date.UTC(2020, 0, 1);  // 2020년 이후여야 유효
```

### player-container.js God Component (1,667줄)
도메인 로직 분리 필요:
```
player-container.js
  ├── handlers/weather-handler.js
  ├── handlers/event-handler.js
  ├── handlers/media-handler.js
  └── handlers/pop-handler.js
```

### initialize.js 거대 Promise 체인 (30+ 단계)
에러 컨텍스트 없이 `.catch` 하나로 모든 단계를 받음 → 단계별 그룹핑 필요

## P2 — 개선 권장

- vxtplayer-main JS/TS 혼재 → 점진적 TS 전환
- vxt-playback abstract 메서드 `throw` 추가 (런타임 검증)
- 플랫폼별 코드 중복 제거 (filesystem, media, network, playTimer)
- ElementText.js (1,117줄), ElementImage.js (1,101줄) 분리

## P3 — 코드 품질

- `app-redux.ts` 장기 주석 처리 코드 삭제
- `content-api.js` 내 상수를 `constants/` 디렉토리로 분리

---

# 7. 메모리 누수 수정 이력 (2026-03-05)

## 수정된 파일

### kernel-time-monitor.js — 재귀 setTimeout → setInterval
```js
// 수정 후
export const monitoringAppropriateTime = (resolve) => {
    const id = setInterval(() => {
        if (Date.now() > UNAPPROPRIATE_TIME) {
            clearInterval(id);
            resolve();
        }
    }, 1000);
    return id;
};
```

### CallbackTimer.js — milliSecProtectedListeners 제거 메서드 추가
```js
removeMilliSecProtectedListener(time, self, callback) { /* ... */ }
clearMilliSecProtectedListeners() { milliSecProtectedListeners.length = 0; }
```

### VxtPlayback.js — subscribeEvents 중복 구독 방지
```js
let _eventsSubscribed = false;
function subscribeEvents() {
    if (_eventsSubscribed) return;
    _eventsSubscribed = true;
    // ...
}
```

### message-container.js — RxJS 구독 모듈 레벨 관리
animationFrames 구독을 컴포넌트 생명주기 밖에서 관리하도록 수정

---

# 8. 개발 도구

## 서버 핫 스왑 (재빌드 없이 JS 교체)

```bash
cd server && node server.js  # 포트 3000
```

Tizen 앱 시작 시 `http://192.168.250.1:3000/index.js` 존재 확인:
- 있음 → 서버 파일 로드
- 없음/타임아웃 → 로컬 빌드 파일 fallback

## CI/CD (GitHub Actions)

```
.github/workflows/
├── github-actions.yml           # 테스트 파이프라인 (push 시 실행)
├── release-action.yml           # Tizen 릴리즈 (S3 업로드)
├── release-for-android-action.yml
├── release-for-epaper-action.yml
└── release-for-windows-action.yml
```

## 빌드 명령어 요약

```bash
# vxtplayer-main
npm run tizen              # Tizen TV 빌드
npm run android:production # Android 프로덕션
npm run electron:build     # Electron 빌드
npm run test:coverage      # Jest 테스트 + 커버리지
npm run lint               # ESLint

# vxt-playback-main
npm run build              # 전체 빌드
npm run build-minimal      # 빠른 개발 빌드
npm run test               # Jest 테스트
```
