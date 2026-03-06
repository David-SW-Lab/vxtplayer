# VXTPlayer / vxt-playback 코드 구조 분석 및 개선 필요 사항

> 분석 기준일: 2026-03-06
> 대상 레포: `vxtplayer-main`, `vxt-playback-main`

---

## 전체 아키텍처 개요

두 레포의 역할 분리:

| 레포 | 역할 | 기술 스택 |
|---|---|---|
| `vxtplayer-main` | 호스트 앱 (스케줄, 디바이스 통신, 상태 관리) | TypeScript + JS 혼재, Redux, RxJS |
| `vxt-playback-main` | 렌더링 엔진 (콘텐츠/엘리먼트 재생) | 순수 JS, 이벤트 버스, 클래스 OOP |

**통신 흐름:**

```
vxtplayer → Redux state → CustomEvent (DOM) → vxt-playback → CustomEvent → Redux
```

---

## 개선 필요 항목

### 1. [P0 · 버그] middleware 순서가 반대로 등록됨

**파일:** `vxtplayer-main/src/app-store.ts` (L93–98)

```js
middleware: [loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]
```

Redux middleware는 배열 왼쪽→오른쪽 순서로 실행됩니다.
현재 `loggerMiddlewareEnd` ("dispatched **E**")가 `loggerMiddleware` ("dispatched **B**")보다 **앞에** 등록되어 있어,
로그가 `E → B` 순으로 찍힙니다 (의도와 정반대).

**수정 방향:**

```js
middleware: [loggerMiddleware, subscribeMiddleware, epicMiddleware, loggerMiddlewareEnd]
```

---

### 2. [P1 · 기술 부채] player-container.js — God Component (1,667줄)

**파일:** `vxtplayer-main/src/components/player/player-container.js`

단일 파일에 다음 도메인 로직이 모두 혼재합니다:
- 날씨 폴링 제어
- 네트워크/군중 이벤트 처리
- 미디어 재생 상태 관리
- 팝업 동기화
- Proof-of-Play 기록
- Realtime Asset 관리
- WineAPI 핸들링

**수정 방향:** 도메인별 핸들러 클래스 또는 훅으로 분리합니다.

```
player-container.js
  ├── handlers/weather-handler.js
  ├── handlers/event-handler.js
  ├── handlers/media-handler.js
  └── handlers/pop-handler.js
```

---

### 3. [P1 · 버그] kernel-time-monitor.js — 오타 및 임계값 오류

**파일:** `vxtplayer-main/src/kernel-time-monitor.js` (L1)

```js
const UNAPPROPRIATE_TIME = 60000; // Thursday, January 1, 1970 12:01:00 AM
```

두 가지 문제:

1. **오타:** `UNAPPROPRIATE` → `INAPPROPRIATE`
2. **임계값 의미 없음:** `Date.now() > 60000`은 1970-01-01 **00:01:00** 이후면 통과합니다.
   기기 RTC 시간이 올바로 설정됐는지 검증하려는 의도라면 임계값이 너무 작습니다.

**수정 방향:**

```js
const INAPPROPRIATE_TIME = Date.UTC(2020, 0, 1); // 2020-01-01 이후여야 유효
```

---

### 4. [P1 · 유지보수] initialize.js — 30+개 함수의 거대 Promise 체인

**파일:** `vxtplayer-main/src/initialize.js` (L86–176)

```js
overrideConsoleOnProduction()
    .then(subscribeToWineApiChannels)
    .then(registerScreenOrientationListener)
    .then(exposePropertiesToWindow)
    // ... 25개 이상 계속 ...
    .catch((err) => { ... })
```

문제점:
- `setTimeout(fn, 50)` 같은 타이밍 의존성이 체인 중간에 섞여 있음
- 에러 발생 시 `.catch` 하나로 모든 단계를 받아 **어느 단계 실패인지 구분 불가**
- 절차적 코드라 단위 테스트가 사실상 불가능

**수정 방향:** 단계별로 그룹핑하고 각 단계에 에러 컨텍스트 태그를 부여합니다.

```js
async function initialize() {
    await initPhase('network', [subscribeToWineApiChannels, registerNetworkChangeListener]);
    await initPhase('device', [initDeviceInfo, initDST, initOSDTime]);
    await initPhase('content', [restoreState, playRestoredContent]);
    // ...
}
```

---

### 5. [P2 · 일관성] TypeScript / JavaScript 혼재 (vxtplayer-main)

| TypeScript 적용 | JavaScript 유지 |
|---|---|
| app-store.ts | player-container.js |
| app-redux.ts | app.js |
| actions.ts | initialize.js |
| visibility-change.ts | plan-check.js |

타입 안전성이 핵심 컴포넌트에서 빠져 있어 런타임 오류 예측이 어렵습니다.
`.js` 파일들을 `.ts`로 점진적으로 전환해야 합니다.

---

### 6. [P2 · 유지보수] 추상 메서드가 런타임에만 검증됨 (vxt-playback-main)

**파일:** `vxt-playback-main/src/js/platforms/base/modules/playTimer.js`

```js
reset()  { /* abstract */ }
isReady() { /* abstract */ }
start()  { /* abstract */ }
```

JS에는 `abstract` 강제가 없어서 플랫폼별 서브클래스가 실제로 override했는지
**컴파일 타임에 검증할 수 없습니다.** 런타임 오류로만 발견됩니다.

**수정 방향 (단기):** 기본 구현에서 즉시 throw를 발생시킵니다.

```js
reset()  { throw new Error('reset() must be overridden by subclass'); }
isReady() { throw new Error('isReady() must be overridden by subclass'); }
```

**수정 방향 (장기):** vxt-playback을 TypeScript로 전환하고 `abstract class`를 사용합니다.

---

### 7. [P2 · 유지보수] 플랫폼 코드 중복 (vxt-playback-main)

같은 이름의 파일이 각 플랫폼별로 반복됩니다:

```
platforms/
  android/modules/filesystem.js
  tizen/modules/filesystem.js
  electron/modules/filesystem.js
  browser/modules/filesystem.js
  tizen-tv/modules/filesystem.js
```

`media.js`, `network.js`, `playTimer.js`, `keyhandler.js`도 동일한 패턴입니다.
`base/` 추상 클래스가 있지만 각 플랫폼 구현체가 독립적으로 너무 많이 중복 구현합니다.

**수정 방향:** 플랫폼 간 공통 로직을 `base/` 계층으로 더 적극적으로 올리고,
플랫폼별 파일에는 **실제로 다른 부분만** 남깁니다.

---

### 8. [P2 · 유지보수] ElementText / ElementImage — God 클래스 (vxt-playback-main)

| 파일 | 줄 수 |
|---|---|
| ElementText.js | 1,117줄 |
| ElementImage.js | 1,101줄 |

렌더링, 애니메이션, 이벤트 핸들링, 데이터 로딩이 단일 클래스에 모두 있습니다.

**수정 방향:** 기능 단위로 분리합니다.

```
ElementText/
  ├── ElementTextRenderer.js   # DOM 렌더링
  ├── ElementTextAnimator.js   # 텍스트 애니메이션
  └── ElementText.js           # 오케스트레이터 (조합)
```

---

### 9. [P3 · 코드 품질] Dead Code 제거 필요

**파일:** `vxtplayer-main/src/app-redux.ts` (L10–11, L57)

```ts
// Rule functionality disabled
// import { dynamicContentRulebasedReducer } ...
// dynamicContentRulebasedPollingEpic,
```

장기간 주석 처리된 코드는 완전히 삭제해야 합니다.
복원이 필요하면 git history에서 찾을 수 있습니다.

---

### 10. [P3 · 코드 품질] 상수가 API 클래스 파일 내부에 정의됨

**파일:** `vxt-playback-main/src/js/api/content-api.js` (L1–38)

```js
export const contentPropertyType = { WIDTH: 'width', HEIGHT: 'height', ... };
export const playStateType = { READY: 'ready', PREPARE: 'prepare', ... };
```

API 구현 파일에 상수가 섞여 있습니다.

**수정 방향:** `constants/` 디렉토리로 분리합니다.

```
constants/
  ├── contentPropertyType.js  ← 이동
  └── playStateType.js        ← 이동
```

---

## 우선순위 요약

| 우선순위 | 항목 | 영향 범위 |
|---|---|---|
| **P0** | middleware 순서 버그 | 모든 Redux action 로그 오염 |
| **P1** | player-container.js 분리 | 유지보수성, 테스트 가능성 |
| **P1** | kernel-time-monitor 임계값 수정 | 기기 시간 검증 신뢰성 |
| **P1** | initialize.js 구조 개선 | 에러 추적, 테스트 가능성 |
| **P2** | vxtplayer-main JS→TS 전환 | 타입 안전성 |
| **P2** | 추상 메서드 throw 추가 | 플랫폼 구현 누락 조기 발견 |
| **P2** | 플랫폼 코드 중복 제거 | vxt-playback 코드 크기 및 유지보수 |
| **P2** | Element God 클래스 분리 | 유지보수성 |
| **P3** | Dead code 제거 | 코드 가독성 |
| **P3** | 상수 위치 정리 | API/상수 경계 명확화 |
