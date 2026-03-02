# vxtplayer-main Module Detailed Reference

## Redux Architecture

### app-store.ts
Redux store configuration file.

- `epicMiddleware`: Async processing via Redux-Observable
- Middleware stack order: `[loggerMiddlewareEnd, subscribeMiddleware, epicMiddleware, loggerMiddleware]`
- `loggerMiddleware`: Attaches logUuid metadata on action dispatch
- `injectReducer(key, reducer)`: Supports dynamic reducer injection
- Redux DevTools enabled in non-production environments

### app-redux.ts
Root reducer and root epic combinator file.

**rootReducer slices:**
- `bgAudio` - Background audio
- `device` - Device settings
- `downloader` - Content downloads
- `entities` - Schedule entities
- `events` - System events
- `logger` - Logs
- `message` - Message display
- `proofOfPlay` - Proof of play tracking
- `realtimeAsset` - Real-time assets
- `scheduleMetadata` - Schedule metadata
- `keepAliveMetadata` - Keep-alive state
- `storages` - Storage
- `watchDog` - Watchdog
- `vxAgentDevice` - VX Agent device
- `wschedulerCommunication` - W-Scheduler communication
- `vxServerCommunication` - VX Server communication
- `appControl` - App control
- `uiElements` - UI elements
- `widgetSubscriptions` - Widget subscriptions
- `playbackCommunication` - Playback communication
- `ePaper` - E-ink display
- `diagnostic` - Diagnostics
- `nsn` - NSN
- `nsnServerCommunication` - NSN Server communication
- `weather` - Weather
- `shuffle` - Shuffle
- `lifespan` - App lifecycle

**rootEpic includes:**
- deleteAssetEpic, downloaderEpic, realtimeAssetEpic
- vxServerCommunicationEpic, etc.

### actions.ts
Global action creators (based on `createAction`).

```typescript
// Key actions
uncaughtErrorOccurred              // Global error handling
appVisibilitySwitchedToBackground  // App lifecycle
screenOrientationReceived          // Screen orientation change
contentScheduleReceived            // Content schedule received
contentScheduleClearingRequested   // Schedule clear request
defaultContentReceived             // Default content received
defaultImageReceived               // Default image received
defaultContentChanged              // Default content changed
deviceTagsReceived                 // Device tags received
screenTagsReceived                 // Screen tags received
triggeredByPlans                   // Plan trigger
playingStorageConnected            // Storage connected
storageRemoved                     // Storage removed
storageSelected                    // Storage selected

// Helper functions
assocDispatchTime()    // Attach dispatch timestamp
dispatchAddLogUuid()   // Attach log UUID
```

---

## Core Modules

### playback-communication Module
**Path:** `src/modules/playback-communication/`

Communication bridge between vxtplayer-main and vxt-playback-main.

**Redux State:**
```typescript
{
  serialEvent: undefined,
  platformApiEventResponse: undefined,
  playerWineEvent: undefined
}
```

**Actions:**
- `updateSerialEvent`: Update serial event
- `updatePlatformApiEventResponse`: Update platform API response
- `updatePlayerWineEvent`: Update Wine player event

---

### device Module
**Path:** `src/modules/device/`

**State Structure:**
```typescript
{
  // Network
  mac, ip, networkStatus, connectionStatus,
  subnetMask, broadcastIp,

  // Device info
  deviceName, deviceModel, serialNumber,
  screenSize, screenResolution,

  // Server settings
  magicINFOServer, edgeServers, downloadServer,
  vxServerUrl, adServer,

  // Display settings
  screenOrientation, customResolution,
  displayMode, panelState, videoPreParingTime,

  // Tags
  screenTags, mediaTags, variableTags,

  // Organization
  organizationId, organizationName,
  workspaceId, workspaceName,

  // Features
  screenWall, popupSchedule, emergency,
  hmacSecret, masterScreenId
}
```

**40+ reducer actions:**
- `edgeServersReceived`, `magicInfoServerReceived`, `networkInfoReceived`
- `deviceModelReceived`, `screenSizeReceived`, `screenResolutionReceived`
- `displayModeReceived`, `adServerReceived`, `panelStateReceived`
- `videoPreparingTimeQueueReceived`, `maxVideoPreparingTimeReceived`

---

### watchdog Module
**Path:** `src/modules/watchdog/`

**State:**
```typescript
{
  reloadCount: number,    // Number of reloads
  time: timestamp,        // Last watchdog timestamp
  isHidden?: boolean,
  exit?: timestamp,
  reload?: timestamp,
  update?: timestamp,
  cacheCleared?: boolean
}
```

**Service Logic (`watchdog-service.ts`):**
- `CLEARLOCALSTORAGE_TIME`: 5+ fires within 30 min → clear localStorage
- `RESET_IGNORE_TIME`: Reset counter after 12 hours
- `CALLTIME_LIMIT`: Limit of 5 calls
- `reloadAppFromWatchdog()`: Trigger app reload
- `isIgnoreWathDog()`: Determine whether to ignore watchdog
- `processWatchDogFired()`: Logic to decide reload / localStorage clear

---

### downloader-proposal Module
**Path:** `src/modules/downloader-proposal/`

**Common State:**
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

**Download type constants (`DOWNLOAD_TYPE`):**
- `ON_NEW_SCHEDULE` - Download on new schedule
- `ON_NEW_TAGS` - Download on new tags
- `ON_NEW_DEFAULT_CONTENT` - Default content download
- `ON_NEW_DEFAULT_IMAGE` - Default image download

**Download status constants (`DOWNLOAD_STATUS`):**
- `NOT_AVAILABLE`, `START`, `DOWNLOADING`, `COMPLETED`
- `FAILED`, `ABORTED`, `HASH_ERROR`, `EMPTY`, `PAUSED`

**Error codes (`DOWNLOAD_ERROR_CODE`):**
- `NOT_ENOUGH_STORAGE`: 2000
- `API_ERROR`: 2001
- `NEED_TO_DELETE_CURRENT_SCHEDULE`: 2002
- `PLATFORM_ERROR`: 2003
- `FAIL_TO_DOWNLOAD_CONTENT`: 2999

**Download completion callbacks:**
- `onContentScheduleFilesDownloadCompleted`
- `onPopupSyncScheduleFilesDownloadCompleted`
- `onEmergencyScheduleFilesDownloadCompleted`
- `onContentScheduleFileEmptyError`

**Initialization:**
- `createAssetsDirectories()`: Creates MAGICINFO_DIRECTORY_PATH and ASSETS directories

---

### proof-of-play Module
**Path:** `src/modules/proof-of-play/`

**State:**
```typescript
{
  duration: 30,         // PoP duration in seconds
  size: 50,             // PoP size
  name: 'PopAllowedType',
  value: ['ALL']
}
```

**Actions:**
- `proofOfPlaySettingsReceived`: Parses PopManagement settings from server ("duration;size" format)

**Collection functions (`collect-pop.ts` - Ramda pipe-based):**
- `writeGeneralPopEntry`: Write general PoP entry
- `writeMediaPopEntry`: Write media PoP entry
- `writeWiNEPopEntry`: Wine media PoP entry
- `writePlaneCheckPopEntry`: Plan check PoP entry

**Upload functions (`upload-pop.ts`):**
- `exportPop`: Export PoP data
- `uploadPopToMagicInfoServer`: Upload to MagicINFO server
- `uploadPopMediaToMagicInfoServer`: Upload media PoP

---

### vx-agent Module
**Path:** `src/modules/vx-agent/`

#### vx-agent-device (sub-module)
VX Agent device configuration and enrollment state.

**State Structure:**
```typescript
{
  // Connection
  connectionStatus,
  bootStrap: boolean,

  // Enrollment
  justEnrolled: boolean,
  activation status,
  deleteDeviceStatus,

  // Security
  useSecureKey, secureKeyInitialized, hmacSecret,

  // VX Server
  url, contentUrl, sns, art, adUrls,
  mqttUrl, timeServerUrl,

  // Device settings (value/result pairs)
  deviceName, deviceType, channel,
  screenTag, mediaTags, variableTags,
  KernelTimezoneArea, KernelTimezone,
  logMnt, proofOfPlayMnt, planInformation
}
```

**Approval status type conversion:**
- `unregistered` → 0
- `activated` → 1
- `deactivated` → 2
- `connection-fail` → 3

**13 reducer actions:**
- `bootstrapStateChanged`, `connectionStateChanged`
- `deviceNameChanged`, `deviceSettingsUpdated`
- `deviceTypeInitialized`, `vxServerInfoInitialized`
- `screenActivationStatusReceived`, `deleteDeviceStatusReceived`

#### vx-server-communication (sub-module)
VX Server API communication state.

**State:**
```typescript
{
  accessToken, refreshToken,
  organizationId,
  scheduleData, scheduleDataCompress,
  messageId,
  mo: {  // message object - includes error handling
    ...
  }
}
```

**Actions:**
- `apiResponseReceived`: Update API response data
- `apiResponseReceivedScheduleData`: Update schedule data (with compress flag)
- `errorResponse`: Handle API errors
- `messageIdReceived`: Update message ID

**Epic (`vx-server-communication-epic.js`):**
- WebSocket connection (sendWebsocketMessage)
- Scheduling and polling
- Authentication token management
- Device enrollment and approval workflows

---

## UI Components (src/components/)

### app.js (Main App)
**Path:** `src/main/app.js`

**E-Paper mode rendering:**
- memoryMonitorComponent
- 2 e-paper containers (id: 'e-paper0', 'e-paper1')
- playerContainer, loggerComponent, pairingCodeWithQrComponent

**Normal mode rendering:**
- memoryMonitorComponent
- playerContainer
- frontLayerComponent
- bgAudioContainer, messageContainer
- loggerComponent
- pairingCodeWithQrComponent
- exitPopupComponent
- playerMenuComponent

### Component List

| Component | Role |
|-----------|------|
| `player/` | Main video player UI |
| `player-menu/` | Player control menu |
| `message/` | Notification/message display |
| `logger/` | Log viewer/debugger UI |
| `settings/` | Settings menu |
| `pairing-code/` | Device pairing code with QR |
| `accessibility/` | Accessibility features |
| `channel-banner/` | Channel name/info banner |
| `background-audio/` | Background audio playback |
| `info-window/` | Information display window |
| `server-settings/` | Server configuration UI |
| `memory-monitor/` | Memory usage monitor |
| `exit-popup/` | Exit confirmation popup |

---

## Utilities (src/utils/)

### platform/ Directory
Platform-specific implementations (Android example).

**File operations:**
- `listFiles`, `resolvePath`, `doesFileExist`
- `copyFile`, `moveFile`
- `createDirectory`, `createFile`, `deleteDirectory`, `deleteFile`
- `readFileAsText`, `readFileAsBase64`, `readFileAsBytes`
- `saveDataAsFile`, `saveBytesAsFile`, `appendDataToFile`
- `getDirectorySize`, `getFileSizeFromPath`
- `openFileStream`: Stream-based file I/O (with close())

**Archive:**
- `addFilesToArchive`, `extractArchiveTo`, `extractArchiveToUsingFileObject`

**Device info:**
- `getMacAddress`, `getSerialNumber`, `getIpAddress`
- `getSubnetMask`, `getBroadcastIp`
- `getDeviceModel`, `getDeviceType`, `getScreenSize`, `getScreenResolution`
- `getMemoryInfo`, `getMemoryStatus`
- `getScreenOrientation`, `getInfoLinkServerType`

**Download:**
- `startDownload`: Create download request with headers and host verification
- `cancelDownload`: Cancel active download
- `setDownloadListener`: Register download progress listener
- `isDownloadInProgress`: Check download status

**Storage:**
- `listStorages`: List USB storages
- `getStorageCapacityInfo`: Get storage capacity info

**App control:**
- `exitCurrentApplication`: Exit app via wb2b.exitApp()
- `rebootDevice`: Reboot via wb2b.rebootDevice()
- `setDeviceVolume`, `getDeviceVolume`: Volume control

**Network:**
- `addNetworkStatusEventListener`: Register network status change listener
- `getNetworkStatus`: Get current network status
- `startUdpStreaming`, `stopUdpStreaming`: UDP streaming

---

## Build Scripts

```bash
# Development
npm start                    # Vite dev server
npm run lint                 # ESLint check
npm run prettier             # Code formatting

# Platform builds
npm run tizen                # Build & deploy to Tizen TV
npm run tizen4               # Tizen v4
npm run tizenE               # Tizen E series
npm run android              # Android build
npm run brightsign:build     # BrightSign
npm run electron:build       # Electron app
npm run electron:start       # Electron dev mode

# Testing
npm test                     # Jest unit tests
npm test:coverage            # With coverage report
npm run e2e                  # E2E tests
```
