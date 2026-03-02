# VXTPlayer Overall Architecture Overview

## Project Metadata

| Item | Value |
|------|-------|
| Author | Samsung Electronics, Visual Display Division |
| Contact | vxt@samsung.com |
| Version | 3.1.36 (both projects share the same version) |
| License | Apache-2.0 |
| Node.js | 18.12.1 (vxtplayer), 16.14.0 (vxt-playback) |

---

## Relationship Between the Two Projects

```
┌─────────────────────────────────────────────────────────────┐
│                      vxtplayer-main                         │
│   (Main App - Server Communication, Schedule Mgmt, UI)      │
│                                                             │
│  VX Server ──► vx-agent ──► Redux Store                    │
│  MagicINFO ──► downloader ──► (content download)           │
│                    │                                        │
│          playback-communication (module)                    │
│                    │ assignJob() / setFrameSchedule()        │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼  (@vxt/playback npm package)
┌─────────────────────────────────────────────────────────────┐
│                    vxt-playback-main                        │
│   (Playback Engine - Handles Actual Multimedia Rendering)   │
│                                                             │
│  PlaybackJobHandler ──► PlaybackPageManager                 │
│  PlayTimerController ──► Page ──► Element ──► DOM Render   │
│  WatchDog (health monitoring)                               │
└─────────────────────────────────────────────────────────────┘
```

### Responsibilities

| Responsibility | Project |
|----------------|---------|
| VX Server communication & schedule reception | vxtplayer-main |
| Content file download management | vxtplayer-main |
| Redux state management | vxtplayer-main |
| Device configuration management | vxtplayer-main |
| Proof of Play collection & upload | vxtplayer-main |
| UI (settings, pairing, logger) | vxtplayer-main |
| Actual content rendering (image/video) | vxt-playback-main |
| Page transitions & visual effects | vxt-playback-main |
| Frame timing synchronization | vxt-playback-main |
| Playback WatchDog | vxt-playback-main |

---

## vxtplayer-main Tech Stack

| Category | Technology |
|----------|-----------|
| Language | TypeScript 4.9.5 |
| State Management | Redux 4.2.1 + Redux-Observable 1.2.0 (RxJS) |
| Build | Vite 5.0.12 |
| Hybrid Framework | Apache Cordova 12.0.0 |
| Functional Utils | Ramda 0.28.0 |
| Async | RxJS 6.6.7 |
| Encryption | crypto-js 4.2.0 |
| Date/Time | moment + moment-timezone |
| Testing | Jest 29.7.0 |

## vxt-playback-main Tech Stack

| Category | Technology |
|----------|-----------|
| Language | JavaScript ES2015 + TypeScript 5.0.4 |
| Build | Rollup 3.29.5 |
| Platform Communication | @supernova/wine-api 2.0.0 |
| Navigation | @supernova/navigation 1.0.8 |
| Data Source | @supernova/data-source 0.3.0 |
| Internationalization | i18next 23.11.5 |
| Timer | play-timer-nacl / play-timer-wasm (NaCl/WASM native) |
| Testing | Jest 29.7.0 (175 test files) |

---

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Tizen (Samsung TV) | Primary | Multiple versions: 4.x, E series, etc. |
| Android | Experimental | Cordova-based |
| Electron (Windows/Linux) | Experimental | Includes RM Player |
| BrightSign | Supported | Separate build |
| Web/Browser | Limited | For development/debugging |

---

## Overall Data Flow

```
1. Boot / Initialization
   - app.js: Create DOM (e-paper / normal mode branch)
   - Redux store initialization
   - VX Agent connection & device registration

2. Schedule Reception
   - VX Server → vx-server-communication-epic.js
   - scheduleData → contentScheduleReceived action
   - downloader module: Start downloading required asset files

3. Download Complete
   - onContentScheduleFilesDownloadCompleted callback
   - playback-communication module → call @vxt/playback API

4. Playback Engine Processing
   - PlaybackJobHandler.setFrameSchedule(data)
   - ResourceManager.loadResourcesFromScheduleData()
   - ScheduleManager.setSchedule()
   - PlaybackPageManager.reload()

5. Rendering
   - Page.load() → Element.load() → DOM insertion
   - PlayTimerController.start()
   - Timer callback → page transition

6. Monitoring
   - WatchDog: detect 0 tick (60s), no schedule (60s)
   - vxtplayer WatchDog: reloadCount, localStorage clear

7. Proof of Play
   - Element.popPlayFinished() → collect-pop.ts
   - upload-pop.ts → Upload to MagicINFO server
```

---

## Build Output Structure (vxt-playback-main)

```
dist/
├── es2015/          # ES2015 module format (per-platform, unbundled)
│   ├── tizen/
│   ├── tizen-tv/
│   ├── android/
│   ├── electron/
│   ├── web/
│   └── browser/
└── commonjs/        # CommonJS bundle format
    └── browser/
```

npm package name: `@vxt/playback`
Main entry: `dist/commonjs/VxtPlayback`
ES2015 entry: `dist/es2015/VxtPlayback.js`
