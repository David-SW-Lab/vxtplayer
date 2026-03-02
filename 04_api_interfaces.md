# API 인터페이스 및 통신 프로토콜 참조

## vxtplayer ↔ vxt-playback 통신

### 진입점
vxtplayer-main의 `playback-communication` 모듈이 vxt-playback의 `PlaybackJobHandler`를 호출함.

```
vxtplayer-main (playback-communication)
    │
    ├── jobHandler.setFrameSchedule(frameScheduleData)
    ├── jobHandler.assignJob(jobData)
    ├── jobHandler.setVariableTags(data)
    └── jobHandler.updateDeviceInfo(data)
```

### frameSchedule 데이터 구조
```javascript
{
  scheduleId: string,
  scheduleVersion: string,
  channel: string,
  // 프레임 스케줄 페이지 배열
  frameSchedules: [
    {
      pageId: string,
      pageName: string,
      duration: number,        // ms
      effects: [...],
      elements: [
        {
          elementId: string,
          elementName: string,
          elementType: string, // 'image' | 'video' | 'html' | 'widget' | ...
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

---

## Player API (window.playerApi / $vx)

vxt-playback-main이 외부에 노출하는 공개 API.

### 진입점: player-api-system.js
```javascript
// 전역 접근
window.playerApi   // PlayerApiForSystem 인스턴스
window.$vxt        // WineApiClient 인스턴스

// 초기화 (VxtPlayback 내부에서 호출)
$vx.hirePlayer(player)
```

---

### Content API
**접근:** `window.playerApi.content`

```javascript
// 페이지 이동
content.movePage(name)           // 이름으로 페이지 이동
content.getGlobalPage(pageId)    // 글로벌 페이지 객체 반환
content.getPage(pageId)          // 로컬 페이지 객체 반환
content.getAllPageNames()         // 모든 페이지 이름 배열 반환

// 상수
content.getPropertyType()        // contentPropertyType 상수 반환
content.getPlayStateType()       // playStateType 상수 반환
```

**contentPropertyType 상수:**
```javascript
// 크기/위치
'width', 'height', 'left', 'top',
'visibility', 'opacity', 'rotation',
'size', 'position'

// 이미지
'flip-x', 'flip-y', 'source', 'flip'

// 텍스트
'font-family', 'font-size', 'font-variant',
'font-color', 'background-color', 'font-weight',
'font-style', 'text-decoration', 'letter-spacing',
'line-height', 'horizontal-align', 'vertical-align', 'text'

// 잠금
'lock-position-size', 'lock-design', 'lock-content'

// 페이지
'name'

// HTML
'user-data'
```

**playStateType 상수:**
```javascript
'READY', 'PREPARE', 'PLAY', 'STOP', 'PAGE_CHANGED'
```

---

### Device API
**접근:** `window.playerApi.device`

```javascript
device.getProperty(name, ...args) // 디바이스 속성 조회
device.getProperties(name, ...args) // getProperty의 별칭
device.getPropertyType()          // devicePropertyType 상수 반환
```

**devicePropertyType 상수:**
```javascript
'PLAYER_VERSION'            // 플레이어 버전
'FIRMWARE_VERSION'          // 펌웨어 버전
'VARIABLE_TAG'              // 변수 태그
'MIS_IP'                    // MIS 서버 IP
'MACADDRESS'                // MAC 주소
'IPADDRESS'                 // IP 주소
'BROADCAST'                 // 브로드캐스트 주소
'SUBNET_MASK'               // 서브넷 마스크
'RESOLUTION'                // 화면 해상도
'ORIENTATION'               // 화면 방향
'SNS_RESOURCE_URL'          // SNS 리소스 URL
'SNS_LOGO_URL'              // SNS 로고 URL
'SNS_ACCESS_TOKEN'          // SNS 액세스 토큰
'VXT_SERVER_URL'            // VXT 서버 URL
'VXT_TIME_SERVER_URL'       // VXT 타임 서버 URL
'DEVICE_NAME'               // 디바이스 이름
'ART_RESOURCE_URL'          // ART 리소스 URL
'VIDEO_PRE_PARING_TIME'     // 비디오 준비 시간
'WIDGET_SUBSCRIPTIONS_EVENT_DATA' // 위젯 구독 이벤트 데이터
'PLAYLIST_META_DATA'        // 플레이리스트 메타데이터
```

---

### Event API
**접근:** `window.playerApi.event`

```javascript
event.publish(type, subType, data)            // 이벤트 발행
event.subscribe(type, subType, callback)      // 이벤트 구독
event.unsubscribeAll()                        // 모든 구독 해제
event.logError(subType, message)              // 에러 이벤트 발행
event.getEventType()                          // 이벤트 타입 상수 반환
```

---

### Utility API
**접근:** `window.playerApi.utility`

```javascript
utility.log(message)    // 사용자 앱 로깅
```

---

## Wine API 통신 시스템

### 채널 구조 (WINE_API_CHANNELS)
```javascript
'keyHandler'    // 키보드 입력 채널
'platformApi'   // 플랫폼 API 채널
'userSettings'  // 사용자 환경설정 채널
'playerApi'     // 플레이어 내부 API 채널
```

### WineApiClient 사용법
```javascript
import { wineApiClient } from './wine-api';

// 동기 발행
wineApiClient.publish(channelKey, publishKey, payload)

// 비동기 발행 (응답 대기)
const response = await wineApiClient.publishAsync(channelKey, publishKey, payload)

// 구독
wineApiClient.subscribe(channelKey, publishKey, callback)

// 구독 해제
wineApiClient.unsubscribe(channelKey, publishKey)
```

### WineEventBusProxy (플레이어 ↔ Wine API 브릿지)
```javascript
import { playerWineEventBusProxy } from './wine-api';

// 단방향 이벤트 전송 (응답 불필요)
playerWineEventBusProxy.broadcastToPlayer(eventType, data)

// 요청-응답 패턴 (60초 타임아웃)
const result = await playerWineEventBusProxy.invokeJobWithResponseAsync(eventType, data)

// 응답 처리
playerWineEventBusProxy.handleJobResponseAsync({requestId, success, data, error})
```

### Wine API 이벤트 타입 (WINE_API_EVENTS)
```javascript
'playerApiEvent'              // 플레이어 API 이벤트
'platformApiEvent'            // 플랫폼 API 이벤트
'platformApiEventStatus'      // 플랫폼 API 상태 업데이트
'platformApiDmHandlerMessage' // 문서 핸들러 메시지
'keyEvent'                    // 키 입력 이벤트
'language'                    // 언어 변경
'userInactivityTime'          // 비활성 타임아웃
'downloadInfo'                // 다운로드 상태
'widgetMessage'               // 위젯 메시지
```

### 플랫폼 API 이벤트 타입 (PLATFORM_API_EVENT_TYPES)
```javascript
// 문서 제어
'openDocument', 'closeDocument',
'playDocument', 'stopDocument'

// 파일 작업
'deleteFile', 'deleteDirectory',
'listFiles', 'doesFileExist'

// 다운로드
'startDownload', 'cancelDownload',
'downloadStatus', 'downloadFileSync'

// 유틸리티
'unzip', 'unzipStatus', 'firmwareVersion'

// 오디오
'startUdpAudioStream', 'stopUdpAudioStream'

// 화면
'setVerticalDocumentOrientation'
```

### Wine API 권한 (PERMISSIONS)
```javascript
'readFileSystem'   // 파일 읽기
'writeFileSystem'  // 파일 쓰기
'readSystemInfo'   // 시스템 정보 읽기
'download'         // 다운로드
'archive'          // 압축/해제
'document'         // 문서 처리
```

---

## 플랫폼 API (src/js/platform/)

vxt-playback 내부에서 사용하는 플랫폼 추상화 레이어.

### platform-api.js 내보내기

```javascript
import {
  filesystem,     // 파일시스템 작업
  html,           // DOM 및 디스플레이 관리
  playTimer,      // 네이티브 재생 타이머 (NaCl/WASM)
  network,        // 네트워크 작업
  udpListener,    // UDP 이벤트 리스너
  utils,          // 유틸리티 함수
  media,          // 미디어 플레이어 추상화
  keyhandler,     // 키보드 입력
  logger,         // 로깅 시스템
  bluetoothManager, // 블루투스
  EventBus        // 이벤트 버스 클래스
} from './platform/platform-api';
```

### 모듈별 주요 API

#### filesystem
```javascript
filesystem.getElementFilePath(...)
filesystem.getIconPath(...)
// 이벤트: ERROR, DEBUG, LOG
```

#### html
```javascript
html.displaySettings        // {resolution, orientation}
html.setScreenWall(...)
html.setCustomResolution(...)
```

#### playTimer (NaCl/WASM 네이티브)
```javascript
playTimer.isReady()
playTimer.start(...)
playTimer.stop()
playTimer.setPlayTimeCallback(callback)
playTimer.setEnableLog()
```

#### network
```javascript
// 이벤트: SET_MAC_FROM_PLATFORM_API
network.eventBus
```

#### media
```javascript
media.setScreenWall(...)
media.setStillModeEnabled(...)
media.getVideoPreparingTime()
// 이벤트: visibility, ERROR, DEBUG, LOG
media.eventBus
```

#### utils (이벤트 버스)
```javascript
// 이벤트 상수
'TOGGLE_PLAY'
'CHANGE_PLAY_TIME'
'UPDATE_*'
utils.platformType  // 플랫폼 타입 체크
```

#### logger
```javascript
logger.log(message)
logger.error(message)
logger.debug(message)
logger.user(message)
// 커스텀 로그 핸들러 등록 가능
```

#### keyhandler
```javascript
keyhandler.registerKeyEvent(key, callback)
keyhandler.registerBackKeyEvent(callback)
keyhandler.registerKeys([...])
```

---

## VX 서버 통신 프로토콜

### 엔드포인트 종류
- Bootstrap API
- Keep-alive API
- Polling API
- Schedule 다운로드 API
- 토큰 API
- Response API
- 디바이스 정보 API

### 통신 방식
- WebSocket (`sendWebsocketMessage`)
- HTTP REST
- MQTT (mqttUrl)

### 인증
- `accessToken` / `refreshToken`
- HMAC 시크릿 기반 보안

### 스케줄 데이터 처리
```javascript
// 압축 형식 지원
scheduleDataCompress: boolean
// 압축된 경우 LZMA 해제 후 파싱
```

---

## 커스텀 이벤트 (DOM CustomEvent)

vxtplayer와 vxt-playback 간 DOM 이벤트 통신.

### vxt-playback → vxtplayer 방향
```javascript
'wplayer:initialized'    // 플레이어 초기화 완료 (버전 정보 포함)
'wplayer:watchDogFired'  // 와치독 발화 (재로드 필요)
```

### vxtplayer → vxt-playback 방향
```javascript
'playerWineEvent'        // Wine API 이벤트 (WineEventBusProxy.REQUEST_EVENT)
```

### wplayer:initialized 페이로드
```javascript
{
  version: string   // @vxt/playback 버전
}
```

### wplayer:watchDogFired 페이로드
```javascript
{
  reason: string   // 재로드 이유 설명
}
```
