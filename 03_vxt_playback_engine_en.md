# vxt-playback-main Playback Engine Detailed Reference

## Core Component Structure

```
VxtPlayback (entry point)
  ├── initialize() - Key handlers, Wine API setup
  ├── PlaybackPageManager (singleton) - Page lifecycle management
  │   ├── Page (double buffering, layer 0/1)
  │   │   └── Element (DOM element)
  │   │       └── Content (media content)
  ├── PlaybackJobHandler (singleton) - Job processing
  ├── PlayTimerController (singleton) - NaCl/WASM timer
  ├── ResourceManager (singleton) - Asset loading
  └── WatchDog (singleton) - Health monitoring
```

---

## VxtPlayback.js — Main Entry Point

**Function:** `VxtPlayback(parentEl)`
- `parentEl`: Parent DOM element where the player is mounted

**DOM Layer Structure (z-index):**
```
10000 - Loading layer
 2001 - Global front page layer 1
 2000 - Global front page layer 0
 1001 - Local content page layer 1
 1000 - Local content page layer 0
  801 - Global back page layer 1
  800 - Global back page layer 0
  101 - Background layer 1
  100 - Background layer 0
```

**Initialization Flow:**
1. Initialize custom `PrintLog` function (for Tizen logging)
2. Wait for `PlayTimerController` readiness
3. Call `PlaybackPageManager.initialize()`
4. Dispatch `wplayer:initialized` event (includes version info)

**Event Subscriptions:**
- `media.eventBus` - Media errors/logging
- `playTimer.eventBus` - Timer events
- `filesystem.eventBus` - Filesystem operations
- `udpListener.eventBus` - UDP events

**Public Methods:**
- `getPlayerEventEl()` - Returns the player wrapper element
- `getJobHandler()` - Returns PlaybackJobHandler singleton

---

## PlaybackJobHandler.js — Job Handler

**Singleton:** `jobHandlerInstance`

**Internal State:**
```javascript
isInitialized         // Initialization flag
isFirstPublish        // First schedule publish flag
prevScheduleId        // Previous schedule ID (deduplication)
prevScheduleVersion   // Previous schedule version
prevChannel           // Previous channel
prevDeviceMediaTags   // Device media tags cache
frameScheduleQueue    // Frame schedule queue
previousVariableTagValues // Variable tag change detection
isBusy                // Job processing lock flag
```

**Public Methods:**

```javascript
validateJson(object)            // Validate JSON objects
setFrameSchedule(data)          // Set frame schedule (push to queue)
updatePublishFrameSchedule(timeTick) // Update and publish frame schedule
updateScreenWall(data)          // Update multi-screen configuration
setCustomResolution(customResolution) // Set custom resolution {width, height}
setPrevFrameScheduleId(ScheduleId)   // Set previous schedule ID
assignJob(data)                 // Process incoming job data (main entry point)
assignPreviewJob()              // Load preview schedule for browser mode
setVariableTags(data)           // Update variable tags
setRealtimeAssetDownload(data)  // Handle realtime asset downloads
updateDeviceInfo(data)          // Update device information
setCustomVideoPreparingTime(data) // Set video preparation time
setAccessToken(data)            // Set SNS/content access token
setEnableTimerLog()             // Enable timer logging
setActivate() / setDeactivate() // Activate/deactivate pages
setShowTime()                   // Toggle time display
setStopPlayer()                 // Stop all playback
updateFillColor(data)           // Update background fill color
moveNextPage()                  // Move to next page
updateSerialEvent(data)         // Publish serial event data
setWeatherData(data)            // Update weather data (UPDATE_WEATHER_EVENT)
setUdpEventSettings(data)       // Register UDP event settings
setCrowdEventSettings(data)     // Set crowd event configuration
handleWineEventResponse(data)   // Handle Wine API responses
handlePlayerWineEvent({channelName, eventName, data}) // Publish player wine events
setWidgetSubscriptionsEvent(data) // Handle widget subscription events
setPlanInfo(plan)               // Set plan subscription status
setMacAddressFromPlatformApi(value) // Set MAC address from platform API
setStillModeEnabled(data.data)  // Enable/disable still mode
setPlaylistMetaData(data.data)  // Set playlist metadata
```

**assignJob Job Types (lowercase switch):**
```javascript
'frameschedule'           // Frame schedule data
'variabletags'            // Variable tag updates
'realtimeassetdownload'   // Asset download status
'updatedeviceinfo'        // Device info update
'updatedviceinfo'         // Same (typo-compat variant)
'customvideopreparingtime'// Video preparation timing
'updatescreenwall'        // Multi-screen update
'accesstoken'             // Access token
'enabletimerlog'          // Enable timer log
'activate' / 'deactivate' // Page activation
'showtime'                // Timestamp overlay
'stopplayer'              // Stop playback
'updatefillcolor'         // Fill color update
'updateserialevent'       // Serial event
'playback:widgetSubscriptionsEvent' // Widget subscription event
```

**Internal Functions:**
```javascript
publishFrameSchedule(timeTick)      // Process queue, load resources, set schedule
isDuplicateSchedule(frameSchedules)  // Detect duplicate schedules
compareScheduleInfo(frameSchedules)  // Deep comparison of schedule data
```

---

## PlayTimerController.js — Timing Controller

**Singleton:** `playTimerControllerInstance`

Wrapper around the native NaCl or WASM PlayTimer module.

**Public Methods:**
```javascript
reset()                                    // Reset timer instance
isReady()                                  // Check initialization state
getVersion()                               // Get NaCl/WASM version string
setFrameSchedulePlayDuration(duration)     // Set total schedule duration (ms)
setContentPlayDuration(duration)           // Set current content duration (ms)
setPagesDuration(pagesDuration)            // Set page duration array
start(syncGroupId, timeServerUrl, ScheduleManager) // Start timer
stop()                                     // Stop timer
notifyToPerformanceMonitor(title, factor, value)   // Send performance metrics
playTimeCallback(contentPlayTime, frameSchedulePlayTime) // Timer callback handler
getPlayTimerInstance()                     // Return native timer instance
adjustContentPlayDuration(duration)        // Adjust current duration (for seek)
movePageTo(duration)                       // Move to specific page time (ms)
enableTimerLog()                           // Enable timer debug logging
```

---

## WatchDog.js — Health Monitor

**Singleton:** `watchDogInstance`

**Monitoring Checks:**

1. **Zero Time Tick Detection**
   - Condition: Continuous 0-tick values for 60+ seconds (600 ticks @ 100ms)
   - Message: `[WATCHDOG] PlayTimer keep sends 0 over 60 seconds. Reload required.`

2. **Overflow Time Tick Detection**
   - Condition: Tick values exceeding total duration for 60+ seconds
   - Message: `[WATCHDOG] PlayTimer keep sends incorrect timeTick bigger than total duration. Reload required.`

3. **Empty Frame Schedule Detection**
   - Condition: No frame schedule published for 60+ seconds
   - Message: `[WATCHDOG] No frameSchedule has been published over 60 seconds. Reload required.`

4. **Media State Issues**
   - Message: `[WATCHDOG] media has problem(Parent element null does not exist)`

**Public Methods:**
```javascript
reset()                     // Reset all counters, clear timers
arm(id, timeout = 10000)    // Arm watchdog timer (default 10s)
disArm(id)                  // Disarm specific timer
pause()                     // Pause all health checks
resume()                    // Resume health checks
fire(reason)                // Manually trigger watchdog
```

**Event Emission:**
- Dispatches `wplayer:watchDogFired` CustomEvent (with reason) → sent to scheduler

---

## PlaybackPageManager.js — Page Manager

**Singleton:** `playbackPageManagerInstance` (1780 lines)

**Internal State:**
```javascript
pageGlobalBacks[]      // Global background pages (2 layers)
pageGlobalFronts[]     // Global foreground pages (2 layers)
pageBackgrounds[]      // Background image pages (2 layers)
pageLocals[]           // Local content pages (2 layers)
currentPageLayer       // Current active local page layer (0 or 1)
currentGlobalPageLayer // Current active global layer
isInitialized          // Player initialization state
isActivated            // Page activation state
isPageInTransition     // Page transition flag
playerState            // Current state (NONE/LOADED/PLAYING/PAUSED/STOPPED)
playingFrameScheduleId // Current schedule ID
playingPageIndex       // Current page index
playingContentIndex    // Current content index
deviceInfo             // Device configuration data
snsAccessToken         // SNS access token
playlistMetaData       // Playlist metadata
```

**Key Public Methods:**
```javascript
initialize()                    // Initialize all page layers (Promise)
reload()                        // Reload current schedule (preload next page)
stopPlayer()                    // Stop all playback
setScheduleStopTime(frameSchedules) // Set schedule stop time
getInitializeStatus()           // Return initialization state
getJobHandler()                 // Return job handler reference
updateDeviceInfo(data)          // Update device configuration
updateCustomVideoPreparingTime(data) // Set video preparation time
setScreenWall(data)             // Set multi-screen configuration
updateToken(data)               // Update SNS access token
pause() / resume()              // Pause/resume playback
activatePages() / deactivatePages() // Activate/deactivate pages
showTime()                      // Toggle time display overlay
updateFillColor()               // Update page background color
enableTimerLog()                // Enable timer debug logging
registerUdpEventSettings(udpEventSetting) // Register UDP events
setStillModeEnabled(stillModeEnabled)     // Enable still frame mode
setPlaylistMetaData(data)       // Set playlist metadata
```

**Adapter Objects (for window.playerApi):**

```javascript
getContentAdaptor()   // Content API adapter
  - movePage(name)
  - getGlobalPage(pageId)
  - getPage(pageId)
  - getAllPageNames()
  - getPropertyType()
  - getPlayStateType()

getDeviceAdaptor()    // Device API adapter
  - getProperty(name, ...args)
  // Supported: PLAYER_VERSION, FIRMWARE_VERSION, VARIABLE_TAG,
  // MIS_IP, MACADDRESS, IPADDRESS, BROADCAST, SUBNET_MASK,
  // RESOLUTION, ORIENTATION, SNS_RESOURCE_URL, SNS_LOGO_URL,
  // SNS_ACCESS_TOKEN, VXT_SERVER_URL, VXT_TIME_SERVER_URL,
  // DEVICE_NAME, VIDEO_PRE_PARING_TIME,
  // WIDGET_SUBSCRIPTIONS_EVENT_DATA, PLAYLIST_META_DATA

getUtilityAdaptor()   // Utility API adapter
  - log(message)

getEventAdaptor()     // Event API adapter
  - publish(type, subType, data)
  - subscribe(type, subType, callback)
  - unsubscribeAll()
  - getEventType()
```

---

## Page.js — Page Representation

**Constructor:** `Page(type, layerIndex)`
- `type`: z-index (layer type)
- `layerIndex`: 0 or 1 (double buffering)

**Public Methods:**
```javascript
load(pageConfig)            // Load page config and elements (Promise)
readyForPrepare()           // Prepare elements before playback
prepare(properties)         // Final preparation for immediate playback ({videoCountInPage})
play(properties)            // Start page playback ({isActivated})
stop()                      // Stop playback and clear configuration
stopNoDelete()              // Pause without clearing
stopInCaseOfUsingIframe()   // Special handling for iframe elements
resume() / pause()          // Resume/pause playback
seek(time)                  // Seek to specific time
adjustPlayDuration(pageLeft) // Adjust remaining duration
getElement(name)            // Get element by name
getAllElementNames()         // Return array of all element names
setProperty(name, value)    // Set editable property (BACKGROUNDCOLOR)
getProperty(name)           // Return readable property (BACKGROUNDCOLOR, NAME)
switchLayersToPlay()        // Make this page the NOW layer
setOpacity(value)           // Set page transparency (0.0~1.0)
setPageBackgroundColor(value) // Set background color (CSS color string)
activate() / deactivate()   // Activate/deactivate all elements
```

---

## Element.js — Content Element

**Constructor:** `Element(elementObj)`

**Public Methods:**
```javascript
load(parentId, resolve, options) // Load element into DOM ({zIndex})
readyForPrepare()                // Prepare for playback
prepare()                        // Final preparation before playback
play(properties)                 // Start playback ({isDlkItem})
stop(isDlkItem)                  // Stop playback
stopInCaseOfUsingIframe()        // Special iframe handling
resume() / pause()               // Resume/pause
seek(time)                       // Seek to time offset
adjustPlayDuration(pageLeft)     // Adjust duration for synchronization

// Properties
setProperty(name, value)         // Set editable property
getProperty(name)                // Return readable property
getElementName()                 // Return element name
getElementType()                 // Return element type

// Events
subscribe(type, callback)        // Subscribe to element events
addEventListener(type, callback) // Add event listener ('click' supported)

// Visual
addClass(classname) / removeClass(classname)
isHidden() / toggleHidden(newState)
removeDefaultEffect(effectType)
setOpacity(value)

// Data
changeMedia(data)                // Change media content
getMediaData()                   // Return current media data
getSlides()                      // Return slide data (for datalink)
iframeExecutor(behavior, target, value) // Execute iframe operations

// Activation
activate() / deactivate()
```

**setProperty Supported Properties:**
```
WIDTH, HEIGHT      - Pixel to percent conversion
LEFT, TOP          - Position in pixels
VISIBILITY         - 'visible' / 'hidden'
OPACITY            - 0.0 ~ 1.0
SIZE               - {width, height}
POSITION           - {left, top}
```

**POP Reporting:**
- `popPlayStarted()` - Record play start
- `popPlayFinished()` - Report element playback PoP (sent to scheduler)
  - Collected info: duration, type, file info, position, styling
  - Supported types: IMAGE, VIDEO, WEB, HTML, WIDGET, MEDIASLIDE, FTPCIFS, ART

---

## ResourceManager.js — Asset Loader

**Singleton:** `ResourceManagerInstance`

**Public Methods:**
```javascript
loadResourcesFromScheduleData(data)    // Load resources from schedule data (Promise)
loadResourcesFromPlayConfig(playConfig) // Load resources from playConfig
```

**Resource types loaded:**
- **Fonts:** `preloadItems.fontFileList` → inject `@font-face` CSS
- **CSS:** `preloadItems.cssFileList` → insert `<link>` tags
- **Translations:** i18next locale data
- **Data Sources:** Datalink configuration (localStorage cache)

---

## initialize.js — Initialization

**Function:** `preInit()`

**Initialization Tasks:**

1. **Register Wine API key event listeners**
   - keydown/keyup events → publish to WINE_API_CHANNELS.keyHandler
   - Broadcast via playerWineEventBusProxy
   - Back key handling

2. **Platform API event broadcasting**
   - Subscribe to platformApi channel
   - Route PLATFORM_API_EVENT_TYPES to player

3. **Firmware version discovery**
   - Async publish to get firmware version
   - Store in utils cache

4. **Navigation initialization (`naviInit()`)**
   - Start @supernova/navigation system
   - Default inactivity duration: 3000ms (overridable via WINE_API_CHANNELS.userSettings)
   - Monitor keys: ArrowUp, ArrowRight, ArrowLeft, ArrowDown, Enter

5. **Widget elements initialization**
   - Initialize appWidget with eventBusInstance

---

## Supported Content Types (src/js/contents/)

| File | Content Type |
|------|-------------|
| ContentImage.js | Image |
| ContentVideo.js | Video |
| ContentSound.js | Audio |
| ContentLFD.js | LFD format |
| ContentDLK.js | DLK (DataLink) format |
| ContentFtpCifs.js | FTP/CIFS network content |
| ContentVX.js | VX-specific content |

## Supported Visual Effects (src/js/effects/)

| Effect | Description |
|--------|-------------|
| EffectBlind | Blind effect |
| EffectCurtain | Curtain effect |
| EffectZoom | Zoom effect |
| EffectStripe | Stripe effect |
| EffectSwiss | Swiss effect |
| EffectTurn | Turn/rotate effect |
| EffectCorner | Corner effect |
| EffectBlackDissolve | Black dissolve effect |
| EffectTextTypingCSS | Text typing effect |
| EffectCommon | Common base effect class |

## Element Types (src/js/elements/)

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

## Build System (Rollup)

**Build Pipeline:**
1. Initialize submodules
2. TypeScript type checking
3. Run linter
4. Generate CSS entry points
5. Generate platform API entry points
6. Per-platform build:
   - CSS compilation (Sass → CSS)
   - JavaScript transpilation (TS/JS → target format)
   - Resource copying
   - Platform-specific sync modules
7. Integrity tests
8. Coverage report generation

```bash
npm run build         # Full build (lint, type check, tests)
npm run build-minimal # Dev build (skip tests/lint)
npm run lint          # ESLint check
npm run test          # Jest tests
npm run test:coverage # Coverage report
```
