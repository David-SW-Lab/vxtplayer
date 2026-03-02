# VXTPlayer 전체 아키텍처 개요

## 프로젝트 메타데이터

| 항목 | 값 |
|------|-----|
| 제작사 | Samsung Electronics, Visual Display Division |
| 연락처 | vxt@samsung.com |
| 버전 | 3.1.36 (두 프로젝트 동일) |
| 라이선스 | Apache-2.0 |
| Node.js | 18.12.1 (vxtplayer), 16.14.0 (vxt-playback) |

---

## 두 프로젝트의 관계

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

### 역할 분담

| 역할 | 담당 프로젝트 |
|------|------------|
| VX 서버 통신 및 스케줄 수신 | vxtplayer-main |
| 콘텐츠 파일 다운로드 관리 | vxtplayer-main |
| Redux 상태 관리 | vxtplayer-main |
| 디바이스 설정 관리 | vxtplayer-main |
| Proof of Play 수집/업로드 | vxtplayer-main |
| UI (설정, 페어링, 로거) | vxtplayer-main |
| 실제 콘텐츠 렌더링 (이미지/영상) | vxt-playback-main |
| 페이지 전환 및 이펙트 | vxt-playback-main |
| 프레임 타이밍 동기화 | vxt-playback-main |
| 플레이백 WatchDog | vxt-playback-main |

---

## vxtplayer-main 기술 스택

| 범주 | 기술 |
|------|-----|
| 언어 | TypeScript 4.9.5 |
| 상태관리 | Redux 4.2.1 + Redux-Observable 1.2.0 (RxJS) |
| 빌드 | Vite 5.0.12 |
| 하이브리드 프레임워크 | Apache Cordova 12.0.0 |
| 함수형 유틸 | Ramda 0.28.0 |
| 비동기 | RxJS 6.6.7 |
| 암호화 | crypto-js 4.2.0 |
| 날짜 | moment + moment-timezone |
| 테스트 | Jest 29.7.0 |

## vxt-playback-main 기술 스택

| 범주 | 기술 |
|------|-----|
| 언어 | JavaScript ES2015 + TypeScript 5.0.4 |
| 빌드 | Rollup 3.29.5 |
| 플랫폼 통신 | @supernova/wine-api 2.0.0 |
| 네비게이션 | @supernova/navigation 1.0.8 |
| 데이터 소스 | @supernova/data-source 0.3.0 |
| 국제화 | i18next 23.11.5 |
| 타이머 | play-timer-nacl / play-timer-wasm (NaCl/WASM 네이티브) |
| 테스트 | Jest 29.7.0 (175개 테스트 파일) |

---

## 지원 플랫폼

| 플랫폼 | 상태 | 비고 |
|--------|------|------|
| Tizen (Samsung TV) | 주력 | 4.x, E 시리즈 등 다수 버전 |
| Android | 실험적 | Cordova 기반 |
| Electron (Windows/Linux) | 실험적 | RM Player 포함 |
| BrightSign | 지원 | 별도 빌드 |
| Web/Browser | 제한적 | 개발/디버그용 |

---

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
   - ScheduleManager.setSchedule()
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

## 빌드 산출물 구조 (vxt-playback-main)

```
dist/
├── es2015/          # ES2015 모듈 형식 (플랫폼별 미번들)
│   ├── tizen/
│   ├── tizen-tv/
│   ├── android/
│   ├── electron/
│   ├── web/
│   └── browser/
└── commonjs/        # CommonJS 번들 형식
    └── browser/
```

npm 패키지명: `@vxt/playback`
메인 진입점: `dist/commonjs/VxtPlayback`
ES2015 진입점: `dist/es2015/VxtPlayback.js`
