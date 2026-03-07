# VXTPlayer — Claude Code 프로젝트 가이드

## 프로젝트 개요

Samsung Electronics Visual Display Division의 Tizen TV용 디지털 사이니지 플레이어.
두 개의 레포로 구성됩니다:

| 레포 | 역할 | 기술 스택 |
|------|------|-----------|
| `vxtplayer-main` | 호스트 앱 (서버 통신, 스케줄, 다운로드, 상태 관리) | TypeScript 4.9.5, Redux, RxJS, Vite, Cordova |
| `vxt-playback-main` | 렌더링 엔진 (`@vxt/playback` npm 패키지) | JavaScript ES2015, Rollup, NaCl/WASM |

## 아키텍처 요약

```
VX Server → vx-agent → Redux Store → playback-communication
                                              │
                                    @vxt/playback (npm)
                                              │
                              PlaybackJobHandler.assignJob()
                                              │
                              PlaybackPageManager → Page → Element → DOM
```

**통신 흐름:**
```
vxtplayer → Redux → CustomEvent (DOM) → vxt-playback → CustomEvent → Redux
```

## 지원 플랫폼

- **Tizen** (Samsung TV) — 주력
- **Android** — Cordova 기반, 실험적
- **Electron** (Windows/Linux) — 실험적
- **BrightSign** — 지원
- **Web/Browser** — 개발/디버그 전용

## 빌드 명령어

```bash
# vxtplayer-main
npm start                    # Vite 개발 서버
npm run tizen                # Tizen TV 빌드
npm run android              # Android 빌드
npm run electron:build       # Electron 빌드
npm run test                 # Jest 테스트
npm run test:coverage        # 커버리지 포함 테스트
npm run lint                 # ESLint

# vxt-playback-main
npm run build                # 전체 빌드 (린트, 타입체크, 테스트 포함)
npm run build-minimal        # 개발 빌드 (테스트/린트 생략)
npm run test                 # Jest 테스트
```

## 핵심 파일 위치

### vxtplayer-main
| 파일 | 역할 |
|------|------|
| `src/app-store.ts` | Redux store 설정, middleware 구성 |
| `src/app-redux.ts` | 루트 리듀서 + 루트 에픽 |
| `src/initialize.js` | 앱 초기화 체인 (30+ 단계) |
| `src/main/app.js` | 메인 앱 엔트리, DOM 구성 |
| `src/components/player/player-container.js` | 핵심 플레이어 UI (1,667줄 God Component) |
| `src/modules/playback-communication/` | vxtplayer ↔ vxt-playback 브릿지 |
| `src/modules/device/` | 디바이스 설정 상태 |
| `src/modules/watchdog/` | 앱 헬스 모니터링 |
| `src/modules/proof-of-play/` | PoP 수집/업로드 |
| `src/kernel-time-monitor.js` | 기기 RTC 시간 유효성 검사 |

### vxt-playback-main
| 파일 | 역할 |
|------|------|
| `src/js/VxtPlayback.js` | 플레이어 메인 진입점 |
| `src/js/PlaybackJobHandler.js` | 잡 처리기, `assignJob()` 디스패치 |
| `src/js/PlaybackPageManager.js` | 페이지 라이프사이클 (1,780줄) |
| `src/js/PlayTimerController.js` | NaCl/WASM 타이머 래퍼 |
| `src/js/WatchDog.js` | 렌더링 헬스 모니터 |
| `src/js/Page.js` | 페이지 표현 (더블 버퍼링) |
| `src/js/Element.js` | 콘텐츠 요소 |
| `src/js/ResourceManager.js` | 폰트/CSS/에셋 로더 |
| `src/js/platform/platform-api.js` | 플랫폼 추상화 레이어 |

## 알려진 버그 및 기술 부채

### P0 — 즉시 수정 필요
1. **`app-store.ts` middleware 순서 역전** (L93–98)
   ```js
   // 현재 (잘못됨)
   middleware: [loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]
   // 수정 필요
   middleware: [loggerMiddleware, subscribeMiddleware, epicMiddleware, loggerMiddlewareEnd]
   ```

### P1 — 중요
2. **`kernel-time-monitor.js` 임계값 오류**: `UNAPPROPRIATE_TIME = 60000` → 1970-01-01 00:01:00 이후면 통과. 올바른 값: `Date.UTC(2020, 0, 1)`
3. **`player-container.js` God Component** (1,667줄): 도메인별 분리 필요
4. **`initialize.js` 거대 Promise 체인** (30+ 단계): 에러 추적 불가

### P2 — 개선 권장
5. vxtplayer-main JS/TS 혼재 → 점진적 TS 전환 필요
6. vxt-playback abstract 메서드 런타임 검증만 가능 → throw 추가
7. 플랫폼별 코드 중복 (filesystem, media, network, playTimer)
8. ElementText.js (1,117줄), ElementImage.js (1,101줄) God 클래스

## 메모리 누수 수정 이력 (2026-03-05)

| 파일 | 수정 내용 |
|------|-----------|
| `kernel-time-monitor.js` | 재귀 setTimeout → setInterval로 교체 |
| `CallbackTimer.js` | `removeMilliSecProtectedListener` / `clearMilliSecProtectedListeners` 추가 |
| `VxtPlayback.js` | `subscribeEvents` 중복 호출 방지 가드 추가 |
| `message-container.js` | RxJS 구독 모듈 레벨 관리 |

수정된 파일: `memory/` 디렉토리 참조

## 서버 핫 스왑 (개발용)

`server/` 디렉토리의 Node.js 서버로 Tizen 재빌드 없이 JS 번들 교체 가능.

```bash
cd server && node server.js   # 포트 3000
```

`settings/tizen-settings.js`의 `defaultServerUrl` 설정 필요.

## API 연동 포인트

### vxtplayer → vxt-playback
```js
jobHandler.setFrameSchedule(frameScheduleData)
jobHandler.assignJob(jobData)
jobHandler.setVariableTags(data)
jobHandler.updateDeviceInfo(data)
```

### DOM CustomEvent
```js
// vxt-playback → vxtplayer
'wplayer:initialized'   // 초기화 완료
'wplayer:watchDogFired' // 재로드 필요

// vxtplayer → vxt-playback
'playerWineEvent'       // Wine API 이벤트
```

### 공개 API (window.playerApi)
```js
window.playerApi.content   // 페이지 이동, 요소 접근
window.playerApi.device    // 디바이스 속성 조회
window.playerApi.event     // 이벤트 발행/구독
window.playerApi.utility   // 로깅
```

## 참고 문서

| 파일 | 내용 |
|------|------|
| `01_architecture_overview.md` | 전체 아키텍처, 데이터 흐름 |
| `02_vxtplayer_modules.md` | vxtplayer-main 모듈 상세 |
| `03_vxt_playback_engine.md` | vxt-playback-main 엔진 상세 |
| `04_api_interfaces.md` | API 인터페이스 및 통신 프로토콜 |
| `05_platform_specifics.md` | 플랫폼별 구현 및 빌드 |
| `06_code_issues_analysis.md` | 코드 이슈 분석 및 개선 사항 |
| `memory/memory-leak-analysis.md` | 메모리 누수 분석 보고서 |
