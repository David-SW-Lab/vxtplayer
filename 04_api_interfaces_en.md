# API Interfaces and Communication Protocol Reference

## vxtplayer ↔ vxt-playback Communication

### Entry Point
The `playback-communication` module in vxtplayer-main calls `PlaybackJobHandler` in vxt-playback.

```
vxtplayer-main (playback-communication)
    │
    ├── jobHandler.setFrameSchedule(frameScheduleData)
    ├── jobHandler.assignJob(jobData)
    ├── jobHandler.setVariableTags(data)
    └── jobHandler.updateDeviceInfo(data)
```

### frameSchedule Data Structure
```javascript
{
  scheduleId: string,
  scheduleVersion: string,
  channel: string,
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

The public API exposed by vxt-playback-main to external consumers.

### Entry Point: player-api-system.js
```javascript
// Global access
window.playerApi   // PlayerApiForSystem instance
window.$vxt        // WineApiClient instance

// Initialization (called internally from VxtPlayback)
$vx.hirePlayer(player)
```

---

### Content API
**Access:** `window.playerApi.content`

```javascript
// Page navigation
content.movePage(name)           // Move to page by name
content.getGlobalPage(pageId)    // Get global page object
content.getPage(pageId)          // Get local page object
content.getAllPageNames()         // Return array of all page names

// Constants
content.getPropertyType()        // Return contentPropertyType constants
content.getPlayStateType()       // Return playStateType constants
```

**contentPropertyType constants:**
```javascript
// Size/Position
'width', 'height', 'left', 'top',
'visibility', 'opacity', 'rotation',
'size', 'position'

// Image
'flip-x', 'flip-y', 'source', 'flip'

// Text
'font-family', 'font-size', 'font-variant',
'font-color', 'background-color', 'font-weight',
'font-style', 'text-decoration', 'letter-spacing',
'line-height', 'horizontal-align', 'vertical-align', 'text'

// Lock
'lock-position-size', 'lock-design', 'lock-content'

// Page
'name'

// HTML
'user-data'
```

**playStateType constants:**
```javascript
'READY', 'PREPARE', 'PLAY', 'STOP', 'PAGE_CHANGED'
```

---

### Device API
**Access:** `window.playerApi.device`

```javascript
device.getProperty(name, ...args) // Query device property
device.getProperties(name, ...args) // Alias for getProperty
device.getPropertyType()          // Return devicePropertyType constants
```

**devicePropertyType constants:**
```javascript
'PLAYER_VERSION'            // Player version
'FIRMWARE_VERSION'          // Firmware version
'VARIABLE_TAG'              // Variable tags
'MIS_IP'                    // MIS server IP
'MACADDRESS'                // MAC address
'IPADDRESS'                 // IP address
'BROADCAST'                 // Broadcast address
'SUBNET_MASK'               // Subnet mask
'RESOLUTION'                // Screen resolution
'ORIENTATION'               // Screen orientation
'SNS_RESOURCE_URL'          // SNS resource URL
'SNS_LOGO_URL'              // SNS logo URL
'SNS_ACCESS_TOKEN'          // SNS access token
'VXT_SERVER_URL'            // VXT server URL
'VXT_TIME_SERVER_URL'       // VXT time server URL
'DEVICE_NAME'               // Device name
'ART_RESOURCE_URL'          // ART resource URL
'VIDEO_PRE_PARING_TIME'     // Video preparation time
'WIDGET_SUBSCRIPTIONS_EVENT_DATA' // Widget subscription event data
'PLAYLIST_META_DATA'        // Playlist metadata
```

---

### Event API
**Access:** `window.playerApi.event`

```javascript
event.publish(type, subType, data)            // Publish event
event.subscribe(type, subType, callback)      // Subscribe to event
event.unsubscribeAll()                        // Clear all subscriptions
event.logError(subType, message)              // Publish error event
event.getEventType()                          // Return event type constants
```

---

### Utility API
**Access:** `window.playerApi.utility`

```javascript
utility.log(message)    // User application logging
```

---

## Wine API Communication System

### Channel Structure (WINE_API_CHANNELS)
```javascript
'keyHandler'    // Keyboard input channel
'platformApi'   // Platform API channel
'userSettings'  // User preferences channel
'playerApi'     // Player internal API channel
```

### WineApiClient Usage
```javascript
import { wineApiClient } from './wine-api';

// Synchronous publish
wineApiClient.publish(channelKey, publishKey, payload)

// Async publish (wait for response)
const response = await wineApiClient.publishAsync(channelKey, publishKey, payload)

// Subscribe
wineApiClient.subscribe(channelKey, publishKey, callback)

// Unsubscribe
wineApiClient.unsubscribe(channelKey, publishKey)
```

### WineEventBusProxy (Player ↔ Wine API bridge)
```javascript
import { playerWineEventBusProxy } from './wine-api';

// One-way event (no response needed)
playerWineEventBusProxy.broadcastToPlayer(eventType, data)

// Request-response pattern (60-second timeout)
const result = await playerWineEventBusProxy.invokeJobWithResponseAsync(eventType, data)

// Handle response
playerWineEventBusProxy.handleJobResponseAsync({requestId, success, data, error})
```

### Wine API Event Types (WINE_API_EVENTS)
```javascript
'playerApiEvent'              // Player API events
'platformApiEvent'            // Platform API events
'platformApiEventStatus'      // Platform API status updates
'platformApiDmHandlerMessage' // Document handler messages
'keyEvent'                    // Key input events
'language'                    // Language change
'userInactivityTime'          // Inactivity timeout
'downloadInfo'                // Download status
'widgetMessage'               // Widget messages
```

### Platform API Event Types (PLATFORM_API_EVENT_TYPES)
```javascript
// Document control
'openDocument', 'closeDocument',
'playDocument', 'stopDocument'

// File operations
'deleteFile', 'deleteDirectory',
'listFiles', 'doesFileExist'

// Download
'startDownload', 'cancelDownload',
'downloadStatus', 'downloadFileSync'

// Utilities
'unzip', 'unzipStatus', 'firmwareVersion'

// Audio
'startUdpAudioStream', 'stopUdpAudioStream'

// Display
'setVerticalDocumentOrientation'
```

### Wine API Permissions (PERMISSIONS)
```javascript
'readFileSystem'   // Read files
'writeFileSystem'  // Write files
'readSystemInfo'   // Read system info
'download'         // Download
'archive'          // Compress/decompress
'document'         // Document handling
```

---

## Platform API (src/js/platform/)

The platform abstraction layer used internally by vxt-playback.

### platform-api.js Exports

```javascript
import {
  filesystem,     // Filesystem operations
  html,           // DOM and display management
  playTimer,      // Native playback timer (NaCl/WASM)
  network,        // Network operations
  udpListener,    // UDP event listener
  utils,          // Utility functions
  media,          // Media player abstraction
  keyhandler,     // Keyboard input
  logger,         // Logging system
  bluetoothManager, // Bluetooth
  EventBus        // Event bus class
} from './platform/platform-api';
```

### Key Module APIs

#### filesystem
```javascript
filesystem.getElementFilePath(...)
filesystem.getIconPath(...)
// Events: ERROR, DEBUG, LOG
```

#### html
```javascript
html.displaySettings        // {resolution, orientation}
html.setScreenWall(...)
html.setCustomResolution(...)
```

#### playTimer (NaCl/WASM native)
```javascript
playTimer.isReady()
playTimer.start(...)
playTimer.stop()
playTimer.setPlayTimeCallback(callback)
playTimer.setEnableLog()
```

#### network
```javascript
// Events: SET_MAC_FROM_PLATFORM_API
network.eventBus
```

#### media
```javascript
media.setScreenWall(...)
media.setStillModeEnabled(...)
media.getVideoPreparingTime()
// Events: visibility, ERROR, DEBUG, LOG
media.eventBus
```

#### utils (event bus)
```javascript
// Event constants
'TOGGLE_PLAY'
'CHANGE_PLAY_TIME'
'UPDATE_*'
utils.platformType  // Platform type check
```

#### logger
```javascript
logger.log(message)
logger.error(message)
logger.debug(message)
logger.user(message)
// Custom log handler registration supported
```

#### keyhandler
```javascript
keyhandler.registerKeyEvent(key, callback)
keyhandler.registerBackKeyEvent(callback)
keyhandler.registerKeys([...])
```

---

## VX Server Communication Protocol

### Endpoint Types
- Bootstrap API
- Keep-alive API
- Polling API
- Schedule download API
- Token API
- Response API
- Device info API

### Communication Methods
- WebSocket (`sendWebsocketMessage`)
- HTTP REST
- MQTT (mqttUrl)

### Authentication
- `accessToken` / `refreshToken`
- HMAC secret-based security

### Schedule Data Processing
```javascript
// Compressed format support
scheduleDataCompress: boolean
// When compressed: decompress with LZMA then parse
```

---

## Custom Events (DOM CustomEvent)

DOM event communication between vxtplayer and vxt-playback.

### vxt-playback → vxtplayer Direction
```javascript
'wplayer:initialized'    // Player initialization complete (includes version info)
'wplayer:watchDogFired'  // Watchdog fired (reload required)
```

### vxtplayer → vxt-playback Direction
```javascript
'playerWineEvent'        // Wine API event (WineEventBusProxy.REQUEST_EVENT)
```

### wplayer:initialized Payload
```javascript
{
  version: string   // @vxt/playback version
}
```

### wplayer:watchDogFired Payload
```javascript
{
  reason: string   // Reload reason description
}
```
