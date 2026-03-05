# 메모리 누수 분석 및 수정 보고서

**분석 일자:** 2026-03-05
**대상:** vxt-playback-main (재생 엔진) + vxtplayer-main (메인 앱)
**증상:** 장시간 실행 시 메모리 사용량 점진적 증가 (누수)

---

## 수정된 파일 목록

| 파일 | 위치 | 수정 내용 |
|------|------|-----------|
| `kernel-time-monitor.js` | vxtplayer-main/src/ | 재귀 setTimeout → setInterval 교체 |
| `CallbackTimer.js` | vxt-playback-main/src/js/player/ | removeMilliSecProtectedListener / clearMilliSecProtectedListeners 추가 |
| `VxtPlayback.js` | vxt-playback-main/src/js/ | subscribeEvents 중복 호출 방지 가드 추가 |
| `message-container.js` | vxtplayer-main/src/components/message/ | RxJS 구독 모듈 레벨 관리 |

---

## 수정 상세

### 1. kernel-time-monitor.js — 재귀 setTimeout [P0]

**원인:** 조건 충족 전까지 1초마다 새 `setTimeout`을 재귀 생성. 이전 timeout의 참조가 사라지면서 JS 엔진이 GC하지 못하는 콜백 체인이 쌓임.

```js
// 기존 (문제)
export const monitoringAppropriateTime = (resolve) =>
    setTimeout(() => {
        if (Date.now() > UNAPPROPRIATE_TIME) {
            resolve();
        } else {
            monitoringAppropriateTime(resolve); // 재귀 — 이전 참조 유실
        }
    }, 1000);

// 수정
export const monitoringAppropriateTime = (resolve) => {
    const id = setInterval(() => {
        if (Date.now() > UNAPPROPRIATE_TIME) {
            clearInterval(id); // 조건 충족 시 정리
            resolve();
        }
    }, 1000);
    return id;
};
```

---

### 2. CallbackTimer.js — milliSecProtectedListeners 배열 무한 증가 [P0]

**원인:** `addMilliSecProtectedListener`는 있지만 대응하는 제거 메서드가 없음. WatchDog이 healthCheck를 등록할 때마다 배열이 증가하고 제거 방법이 없음.

```js
// 추가된 메서드
removeMilliSecProtectedListener(time, self, callback) {
    const listener = { switchTime: time, element: self, callback };
    for (let i = milliSecProtectedListeners.length - 1; i >= 0; i--) {
        if (
            listener.switchTime === milliSecProtectedListeners[i].switchTime &&
            listener.element === milliSecProtectedListeners[i].element &&
            listener.callback === milliSecProtectedListeners[i].callback
        ) {
            milliSecProtectedListeners.splice(i, 1);
        }
    }
},
clearMilliSecProtectedListeners() {
    milliSecProtectedListeners.length = 0;
},
```

**참고:** WatchDog.js에서 `addMilliSecProtectedListener` 호출 후 정리 시 `removeMilliSecProtectedListener` 또는 `clearMilliSecProtectedListeners` 사용 필요.

---

### 3. VxtPlayback.js — subscribeEvents 중복 구독 [P1]

**원인:** `VxtPlayback(parentEl)` 팩토리 함수가 여러 번 호출될 경우(플레이어 재초기화), `media`, `playTimer`, `udpListener` 등의 싱글톤에 동일한 핸들러가 중복 등록됨.

```js
// 수정: 모듈 레벨 가드
const _eventSubscriptions = [];
let _eventsSubscribed = false;

function subscribeEvents() {
    if (_eventsSubscribed) return; // 중복 호출 방지
    _eventsSubscribed = true;

    _eventSubscriptions.push(
        media.subscribe(media.eventBus.eventType.ERROR, (error) => { errorLog(error, '109'); })
    );
    // ... 나머지 구독도 동일하게 push
}
```

---

### 4. message-container.js — RxJS animationFrames 구독 누수 [P1]

**원인:** `animationFrames(Date)` 스트림 구독 후 반환값을 저장하지 않음. `messageContainer()`가 재호출될 때 이전 구독이 해제되지 않아 60fps 콜백이 중복 실행됨.

```js
// 수정: 모듈 레벨에서 이전 구독 관리
let _activeSubscription = null;

export default function messageContainer() {
    if (_activeSubscription) {
        _activeSubscription.unsubscribe(); // 이전 구독 해제
        _activeSubscription = null;
    }
    // ...
    _activeSubscription = changeMessage$.subscribe((timestamp) => {
        updateMessage(timestamp);
    });
}
```

---

## 분석 결과 재검토 (오탐 항목)

아래 항목들은 초기 분석에서 이슈로 분류되었으나, 코드 재확인 결과 실제 누수가 아님:

| 파일 | 초기 분석 | 실제 상태 |
|------|----------|-----------|
| `entities-redux.js` | detailsFHD 배열 무한 증가 | `clearAssetsDetailsRequested` 핸들러(line 410-416)에서 `detailsFHD`도 함께 클리어됨. 스케줄 변경 시 정상 정리. |
| `events-redux.ts` | events state 무한 누적 | `eventsReceived` 핸들러(line 142-158)가 기존 state를 완전히 교체(replace). 누적 아님. |
| `websocket-keepalive-util.js` | Promise 클로저가 전체 state 포획 | 함수 시작 시 필요한 프로퍼티만 지역 변수로 추출. 100ms 후 Promise 해소. 실제 누수 없음. |
| `downloader-redux.ts` | downloadIds 배열 미정리 | `removeDownloadId` 리듀서 존재. `contentScheduleClearingRequested`로 스케줄 변경 시 리셋. |
| `diagnostic.js` | 이벤트 리스너 미해제 | `initDiagnostic()`은 앱 시작 시 1회만 호출. `playerVersionDiv`는 앱 생명주기와 동일. |
| `PlaybackPageManager.js` media visibility | media.subscribe 미해제 | Singleton 패턴(`getInstance()`)으로 `init()` 1회만 실행. 정상. |

---

## 미수정 항목 (추가 검토 필요)

### ElementWidget.js — media 구독 race condition
**파일:** `vxt-playback-main/src/js/elements/ElementWidget.js`

구독 콜백 내부에서 자기 자신을 unsubscribe하는 패턴에서, 구독 참조가 덮어쓰여지기 전에 콜백이 실행될 경우 발생하는 race condition. 영향은 낮으나 복잡한 로직 변경이 필요하여 별도 검토 필요.

### PlaybackPageManager.js — playerApiEvents 배열
**파일:** `vxt-playback-main/src/js/PlaybackPageManager.js` (line 36)

`stop()` 호출 전까지 쌓이는 전역 배열이지만, `getEventAdaptor().unsubscribeAll()`에서 정리됨. 페이지 전환이 매우 빈번하고 `stop()`이 늦게 호출되는 환경에서는 일시적으로 누적될 수 있음. 실제 문제 여부는 런타임 프로파일링으로 확인 필요.
