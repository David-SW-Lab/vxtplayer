# vxt-playback-main 플레이백 엔진 상세 참조

## 핵심 컴포넌트 구조

```
VxtPlayback (진입점)
  ├── initialize() - 키 핸들러, Wine API 초기화
  ├── PlaybackPageManager (싱글톤) - 페이지 라이프사이클 관리
  │   ├── Page (더블 버퍼링, 0/1 레이어)
  │   │   └── Element (DOM 요소)
  │   │       └── Content (미디어 콘텐츠)
  ├── PlaybackJobHandler (싱글톤) - 잡 처리
  ├── PlayTimerController (싱글톤) - NaCl/WASM 타이머
  ├── ResourceManager (싱글톤) - 에셋 로딩
  └── WatchDog (싱글톤) - 헬스 모니터링
```

---

## VxtPlayback.js — 메인 진입점

**함수:** `VxtPlayback(parentEl)`
- `parentEl`: 플레이어가 마운트될 부모 DOM 요소

**DOM 레이어 구조 (z-index):**
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

**초기화 플로우:**
1. `PrintLog` 커스텀 로그 함수 초기화 (Tizen 용)
2. `PlayTimerController` 준비 대기
3. `PlaybackPageManager.initialize()` 호출
4. `wplayer:initialized` 이벤트 dispatch (버전 정보 포함)

**이벤트 구독:**
- `media.eventBus` - 미디어 에러/로그
- `playTimer.eventBus` - 타이머 이벤트
- `filesystem.eventBus` - 파일시스템 작업
- `udpListener.eventBus` - UDP 이벤트

**공개 메서드:**
- `getPlayerEventEl()` - 플레이어 래퍼 요소 반환
- `getJobHandler()` - PlaybackJobHandler 싱글톤 반환

---

## PlaybackJobHandler.js — 잡 처리기

**싱글톤:** `jobHandlerInstance`

**내부 상태:**
```javascript
isInitialized         // 초기화 플래그
isFirstPublish        // 첫 스케줄 발행 여부
prevScheduleId        // 중복 방지용 이전 스케줄 ID
prevScheduleVersion   // 이전 스케줄 버전
prevChannel           // 이전 채널
prevDeviceMediaTags   // 디바이스 미디어 태그 캐시
frameScheduleQueue    // 프레임 스케줄 큐
previousVariableTagValues // 변수 태그 변경 감지
isBusy                // 잡 처리 잠금 플래그
```

**공개 메서드:**

```javascript
validateJson(object)            // JSON 객체 유효성 검사
setFrameSchedule(data)          // 프레임 스케줄 설정 (큐에 추가)
updatePublishFrameSchedule(timeTick) // 타임틱으로 스케줄 업데이트
updateScreenWall(data)          // 멀티스크린 설정 업데이트
setCustomResolution(customResolution) // 커스텀 해상도 {width, height}
setPrevFrameScheduleId(ScheduleId)   // 이전 스케줄 ID 설정
assignJob(data)                 // 잡 데이터 처리 (메인 진입점)
assignPreviewJob()              // 브라우저 모드 프리뷰 스케줄 로드
setVariableTags(data)           // 변수 태그 업데이트
setRealtimeAssetDownload(data)  // 실시간 에셋 다운로드 처리
updateDeviceInfo(data)          // 디바이스 정보 업데이트
setCustomVideoPreparingTime(data) // 비디오 준비 시간 설정
setAccessToken(data)            // SNS/콘텐츠 액세스 토큰 설정
setEnableTimerLog()             // 타이머 로깅 활성화
setActivate() / setDeactivate() // 페이지 활성화/비활성화
setShowTime()                   // 시간 표시 토글
setStopPlayer()                 // 전체 재생 정지
updateFillColor(data)           // 배경 fill 색상 업데이트
moveNextPage()                  // 다음 페이지로 이동
updateSerialEvent(data)         // 시리얼 이벤트 발행
setWeatherData(data)            // 날씨 데이터 업데이트 (UPDATE_WEATHER_EVENT)
setUdpEventSettings(data)       // UDP 이벤트 설정 등록
setCrowdEventSettings(data)     // 크라우드 이벤트 설정
handleWineEventResponse(data)   // Wine API 응답 처리
handlePlayerWineEvent({channelName, eventName, data}) // Wine 이벤트 발행
setWidgetSubscriptionsEvent(data) // 위젯 구독 이벤트 처리
setPlanInfo(plan)               // 플랜 구독 상태 설정
setMacAddressFromPlatformApi(value) // 플랫폼 API에서 MAC 주소 설정
setStillModeEnabled(data.data)  // 스틸 모드 활성화/비활성화
setPlaylistMetaData(data.data)  // 플레이리스트 메타데이터 설정
```

**assignJob 처리 잡 타입 (소문자 switch):**
```javascript
'frameschedule'           // 프레임 스케줄 데이터
'variabletags'            // 변수 태그 업데이트
'realtimeassetdownload'   // 에셋 다운로드 상태
'updatedeviceinfo'        // 디바이스 정보 업데이트
'updatedviceinfo'         // 위와 동일 (오타 버전 호환)
'customvideopreparingtime'// 비디오 준비 타이밍
'updatescreenwall'        // 멀티스크린 업데이트
'accesstoken'             // 액세스 토큰
'enabletimerlog'          // 타이머 로그 활성화
'activate' / 'deactivate' // 페이지 활성화
'showtime'                // 타임스탬프 오버레이
'stopplayer'              // 재생 정지
'updatefillcolor'         // fill 색상 업데이트
'updateserialevent'       // 시리얼 이벤트
'playback:widgetSubscriptionsEvent' // 위젯 구독 이벤트
```

**내부 함수:**
```javascript
publishFrameSchedule(timeTick)     // 큐 처리, 리소스 로드, 스케줄 설정
isDuplicateSchedule(frameSchedules) // 중복 스케줄 감지
compareScheduleInfo(frameSchedules) // 스케줄 데이터 심층 비교
```

---

## PlayTimerController.js — 타이밍 제어

**싱글톤:** `playTimerControllerInstance`

NaCl 또는 WASM 기반 네이티브 PlayTimer 모듈 래퍼.

**공개 메서드:**
```javascript
reset()                                    // 타이머 초기화
isReady()                                  // 초기화 여부 확인
getVersion()                               // NaCl/WASM 버전 문자열 반환
setFrameSchedulePlayDuration(duration)     // 전체 스케줄 지속 시간 설정 (ms)
setContentPlayDuration(duration)           // 현재 콘텐츠 지속 시간 설정 (ms)
setPagesDuration(pagesDuration)            // 페이지 지속 시간 배열 설정
start(syncGroupId, timeServerUrl, ScheduleManager) // 타이머 시작
stop()                                     // 타이머 정지
notifyToPerformanceMonitor(title, factor, value)   // 성능 지표 전송
playTimeCallback(contentPlayTime, frameSchedulePlayTime) // 타이머 콜백 처리
getPlayTimerInstance()                     // 네이티브 타이머 인스턴스 반환
adjustContentPlayDuration(duration)        // 현재 지속 시간 조정 (seek용)
movePageTo(duration)                       // 특정 페이지 시간으로 이동 (ms)
enableTimerLog()                           // 타이머 디버그 로깅 활성화
```

---

## WatchDog.js — 헬스 모니터

**싱글톤:** `watchDogInstance`

**모니터링 항목:**

1. **제로 타임틱 감지**
   - 조건: 60초 이상(600틱 @ 100ms 간격) 지속적으로 0 틱
   - 메시지: `[WATCHDOG] PlayTimer keep sends 0 over 60 seconds. Reload required.`

2. **오버플로 타임틱 감지**
   - 조건: 전체 지속 시간 초과 틱값이 60초 지속
   - 메시지: `[WATCHDOG] PlayTimer keep sends incorrect timeTick bigger than total duration. Reload required.`

3. **빈 프레임 스케줄 감지**
   - 조건: 60초 이상 프레임 스케줄 미발행
   - 메시지: `[WATCHDOG] No frameSchedule has been published over 60 seconds. Reload required.`

4. **미디어 상태 이슈**
   - 메시지: `[WATCHDOG] media has problem(Parent element null does not exist)`

**공개 메서드:**
```javascript
reset()                     // 모든 카운터 초기화, 타이머 클리어
arm(id, timeout = 10000)    // 와치독 타이머 무장 (기본 10초)
disArm(id)                  // 특정 타이머 해제
pause()                     // 모든 헬스 체크 일시 중지
resume()                    // 헬스 체크 재개
fire(reason)                // 수동으로 와치독 트리거
```

**이벤트 발행:**
- `wplayer:watchDogFired` CustomEvent (이유 포함) → 스케줄러에 전달

---

## PlaybackPageManager.js — 페이지 관리자

**싱글톤:** `playbackPageManagerInstance` (1780줄)

**내부 상태:**
```javascript
pageGlobalBacks[]      // 글로벌 배경 페이지 (2 레이어)
pageGlobalFronts[]     // 글로벌 전면 페이지 (2 레이어)
pageBackgrounds[]      // 배경 이미지 페이지 (2 레이어)
pageLocals[]           // 로컬 콘텐츠 페이지 (2 레이어)
currentPageLayer       // 현재 로컬 페이지 레이어 (0 또는 1)
currentGlobalPageLayer // 현재 글로벌 레이어
isInitialized          // 플레이어 초기화 상태
isActivated            // 페이지 활성화 상태
isPageInTransition     // 페이지 전환 플래그
playerState            // 현재 상태 (NONE/LOADED/PLAYING/PAUSED/STOPPED)
playingFrameScheduleId // 현재 스케줄 ID
playingPageIndex       // 현재 페이지 인덱스
playingContentIndex    // 현재 콘텐츠 인덱스
deviceInfo             // 디바이스 설정 데이터
snsAccessToken         // SNS 액세스 토큰
playlistMetaData       // 플레이리스트 메타데이터
```

**주요 공개 메서드:**
```javascript
initialize()                    // 모든 페이지 레이어 초기화 (Promise)
reload()                        // 현재 스케줄 재로드 (다음 페이지 프리로드)
stopPlayer()                    // 모든 재생 정지
setScheduleStopTime(frameSchedules) // 스케줄 정지 시간 설정
getInitializeStatus()           // 초기화 상태 반환
getJobHandler()                 // 잡 핸들러 참조 반환
updateDeviceInfo(data)          // 디바이스 설정 업데이트
updateCustomVideoPreparingTime(data) // 비디오 준비 시간 설정
setScreenWall(data)             // 멀티스크린 설정
updateToken(data)               // SNS 액세스 토큰 업데이트
pause() / resume()              // 재생 일시정지/재개
activatePages() / deactivatePages() // 페이지 활성화/비활성화
showTime()                      // 시간 표시 오버레이 토글
updateFillColor()               // 페이지 배경 색상 업데이트
enableTimerLog()                // 타이머 디버그 로깅
registerUdpEventSettings(udpEventSetting) // UDP 이벤트 등록
setStillModeEnabled(stillModeEnabled)     // 스틸 프레임 모드
setPlaylistMetaData(data)       // 플레이리스트 메타데이터 설정
```

**어댑터 객체 (window.playerApi 용):**

```javascript
getContentAdaptor()   // 콘텐츠 API 어댑터
  - movePage(name)
  - getGlobalPage(pageId)
  - getPage(pageId)
  - getAllPageNames()
  - getPropertyType()
  - getPlayStateType()

getDeviceAdaptor()    // 디바이스 API 어댑터
  - getProperty(name, ...args)
  // 지원 속성: PLAYER_VERSION, FIRMWARE_VERSION, VARIABLE_TAG,
  // MIS_IP, MACADDRESS, IPADDRESS, BROADCAST, SUBNET_MASK,
  // RESOLUTION, ORIENTATION, SNS_RESOURCE_URL, SNS_LOGO_URL,
  // SNS_ACCESS_TOKEN, VXT_SERVER_URL, VXT_TIME_SERVER_URL,
  // DEVICE_NAME, VIDEO_PRE_PARING_TIME,
  // WIDGET_SUBSCRIPTIONS_EVENT_DATA, PLAYLIST_META_DATA

getUtilityAdaptor()   // 유틸리티 API 어댑터
  - log(message)

getEventAdaptor()     // 이벤트 API 어댑터
  - publish(type, subType, data)
  - subscribe(type, subType, callback)
  - unsubscribeAll()
  - getEventType()
```

---

## Page.js — 페이지 표현

**생성자:** `Page(type, layerIndex)`
- `type`: z-index (레이어 타입)
- `layerIndex`: 0 또는 1 (더블 버퍼링)

**공개 메서드:**
```javascript
load(pageConfig)            // 페이지 설정 및 요소 로드 (Promise)
readyForPrepare()           // 재생 전 요소 준비
prepare(properties)         // 즉시 재생을 위한 최종 준비 ({videoCountInPage})
play(properties)            // 페이지 재생 시작 ({isActivated})
stop()                      // 재생 정지 및 설정 초기화
stopNoDelete()              // 삭제 없이 일시 정지
stopInCaseOfUsingIframe()   // iframe 요소 특수 처리
resume() / pause()          // 재생 재개/일시정지
seek(time)                  // 특정 시간으로 이동
adjustPlayDuration(pageLeft) // 남은 지속 시간 조정
getElement(name)            // 이름으로 요소 가져오기
getAllElementNames()         // 모든 요소 이름 배열 반환
setProperty(name, value)    // 편집 가능 속성 설정 (BACKGROUNDCOLOR)
getProperty(name)           // 읽기 가능 속성 반환 (BACKGROUNDCOLOR, NAME)
switchLayersToPlay()        // 이 페이지를 NOW 레이어로 전환
setOpacity(value)           // 페이지 투명도 설정 (0.0~1.0)
setPageBackgroundColor(value) // 배경 색상 설정 (CSS 색상 문자열)
activate() / deactivate()   // 모든 요소 활성화/비활성화
```

---

## Element.js — 콘텐츠 요소

**생성자:** `Element(elementObj)`

**공개 메서드:**
```javascript
load(parentId, resolve, options) // DOM에 요소 로드 ({zIndex})
readyForPrepare()                // 재생 준비
prepare()                        // 재생 직전 최종 준비
play(properties)                 // 재생 시작 ({isDlkItem})
stop(isDlkItem)                  // 재생 정지
stopInCaseOfUsingIframe()        // iframe 특수 처리
resume() / pause()               // 재개/일시정지
seek(time)                       // 시간 이동
adjustPlayDuration(pageLeft)     // 동기화를 위한 지속 시간 조정

// 속성
setProperty(name, value)         // 편집 가능 속성 설정
getProperty(name)                // 읽기 가능 속성 반환
getElementName()                 // 요소 이름 반환
getElementType()                 // 요소 타입 반환

// 이벤트
subscribe(type, callback)        // 요소 이벤트 구독
addEventListener(type, callback) // 이벤트 리스너 추가 ('click' 지원)

// 시각
addClass(classname) / removeClass(classname)
isHidden() / toggleHidden(newState)
removeDefaultEffect(effectType)
setOpacity(value)

// 데이터
changeMedia(data)                // 미디어 콘텐츠 변경
getMediaData()                   // 현재 미디어 데이터 반환
getSlides()                      // 슬라이드 데이터 반환 (datalink용)
iframeExecutor(behavior, target, value) // iframe 작업 실행

// 활성화
activate() / deactivate()
```

**setProperty 지원 속성:**
```
WIDTH, HEIGHT      - 픽셀 → 퍼센트 변환
LEFT, TOP          - 위치 (픽셀)
VISIBILITY         - 'visible' / 'hidden'
OPACITY            - 0.0 ~ 1.0
SIZE               - {width, height}
POSITION           - {left, top}
```

**POP 보고:**
- `popPlayStarted()` - 재생 시작 기록
- `popPlayFinished()` - 요소 재생 PoP 보고 (스케줄러로 전송)
  - 수집 정보: duration, type, file info, position, styling
  - 지원 타입: IMAGE, VIDEO, WEB, HTML, WIDGET, MEDIASLIDE, FTPCIFS, ART

---

## ResourceManager.js — 에셋 로더

**싱글톤:** `ResourceManagerInstance`

**공개 메서드:**
```javascript
loadResourcesFromScheduleData(data)    // 스케줄 데이터에서 리소스 로드 (Promise)
loadResourcesFromPlayConfig(playConfig) // playConfig에서 리소스 로드
```

**로드하는 리소스 종류:**
- **폰트:** `preloadItems.fontFileList` → `@font-face` CSS 주입
- **CSS:** `preloadItems.cssFileList` → `<link>` 태그 삽입
- **번역:** i18next 로케일 데이터
- **데이터 소스:** datalink 설정 (localStorage 캐시)

---

## initialize.js — 초기화

**함수:** `preInit()`

**초기화 작업:**

1. **Wine API 키 이벤트 리스너 등록**
   - keydown/keyup 이벤트 → WINE_API_CHANNELS.keyHandler 발행
   - playerWineEventBusProxy로 브로드캐스트
   - Back 키 처리

2. **플랫폼 API 이벤트 브로드캐스트**
   - platformApi 채널 구독
   - PLATFORM_API_EVENT_TYPES → 플레이어로 라우팅

3. **펌웨어 버전 조회**
   - 비동기 발행으로 펌웨어 버전 수집
   - utils 캐시에 설정

4. **내비게이션 초기화 (`naviInit()`)**
   - @supernova/navigation 시스템 시작
   - 기본 비활성 지속 시간: 3000ms (WINE_API_CHANNELS.userSettings로 재정의 가능)
   - 방향키 모니터링: ArrowUp, ArrowRight, ArrowLeft, ArrowDown, Enter

5. **위젯 요소 초기화**
   - appWidget을 eventBusInstance로 초기화

---

## 지원 콘텐츠 타입 (src/js/contents/)

| 파일 | 콘텐츠 타입 |
|------|------------|
| ContentImage.js | 이미지 |
| ContentVideo.js | 비디오 |
| ContentSound.js | 오디오 |
| ContentLFD.js | LFD 포맷 |
| ContentDLK.js | DLK (DataLink) 포맷 |
| ContentFtpCifs.js | FTP/CIFS 네트워크 콘텐츠 |
| ContentVX.js | VX 전용 콘텐츠 |

## 지원 비주얼 이펙트 (src/js/effects/)

| 이펙트 | 설명 |
|--------|------|
| EffectBlind | 블라인드 효과 |
| EffectCurtain | 커튼 효과 |
| EffectZoom | 줌 효과 |
| EffectStripe | 스트라이프 효과 |
| EffectSwiss | 스위스 효과 |
| EffectTurn | 회전 효과 |
| EffectCorner | 코너 효과 |
| EffectBlackDissolve | 블랙 디졸브 효과 |
| EffectTextTypingCSS | 텍스트 타이핑 효과 |
| EffectCommon | 공통 효과 기반 클래스 |

## 요소 타입 (src/js/elements/)

```
Image, Audio, Shape, Color, HTML
MediaSlide, DataLink
Clock (Analog / Digital)
Widgets:
  MenuBoardWidget
  NavigationWidget
  ExpansionWidget
  RotateWidget
```

---

## 빌드 시스템 (Rollup)

**빌드 파이프라인:**
1. 서브모듈 초기화
2. TypeScript 타입 검사
3. 린터 실행
4. CSS 진입점 생성
5. 플랫폼 API 진입점 생성
6. 플랫폼별 빌드:
   - CSS 컴파일 (Sass → CSS)
   - JavaScript 트랜스파일 (TS/JS → 타겟 포맷)
   - 리소스 복사
   - 플랫폼별 동기화 모듈
7. 무결성 테스트
8. 커버리지 리포트 생성

```bash
npm run build         # 전체 빌드 (린트, 타입체크, 테스트 포함)
npm run build-minimal # 개발 빌드 (테스트/린트 생략)
npm run lint          # ESLint 검사
npm run test          # Jest 테스트
npm run test:coverage # 커버리지 리포트
```
