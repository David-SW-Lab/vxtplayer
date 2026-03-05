/* eslint-disable no-console */
/**
 * @file wplayer -> vxtPlayback
 * @author Jihoon Son(Steve) (jihoon83.son@samsung.com)
 * @date 2019-02-21
 * @description
 * Application component is an entry point to the application where other components are inserted into the DOM.
 * @copyright Copyright (c) 2018 Samsung Electronics, Visual Display Division. All Rights Reserved.
 */

import zIndex from './constants/z-index';
import { PAGES_IDS, PLAYER_APP_ID } from './constants/elementIds';
import initialize from './initialize';
import JobHandler from './PlaybackJobHandler';
import { filesystem, logger, media, playTimer, udpListener, utils } from './platform/platform-api';
import playbackPageManager from './PlaybackPageManager';
import PlayTimerController from './PlayTimerController';
import dispatchEvent from './util/WSchedulerProxy';
import { wplayerTimestamp, wplayerVersion } from './version';
import intervalManager from './util/intervalManager';

// [FIX] 모듈 레벨 구독 관리
// VxtPlayback()이 여러 번 호출될 경우 media/playTimer/udpListener 싱글톤에
// 구독이 중복으로 쌓이는 것을 방지
const _eventSubscriptions = [];
let _eventsSubscribed = false;

export default function VxtPlayback(parentEl) {
    // register custom printLog function
    logger.registerCustomPrintLog(logger.types.tizen, (message, type, fileName, key, color) => {
        dispatchEvent({
            type: 'wplayer:log',
            level: type,
            data: `${key}#${message}[${fileName}]`,
            color
        });
    });

    logger.log('[PLAYER_INIT] 00. Starting WPlayer Constructor', 'vxtPlayback.js', 'blue');

    let el;
    let jobList = [];

    function createDom(parentElement) {
        const playerWrapper = parentElement;

        const playerAppDiv = document.createElement('div');
        playerAppDiv.setAttribute('id', PLAYER_APP_ID);
        el = playerAppDiv;

        const emptyNavigableEl = document.createElement('navigable-item');
        emptyNavigableEl.id = 'emptyNavigableEl';
        emptyNavigableEl.setAttribute('width', '0');
        emptyNavigableEl.setAttribute('height', '0');
        playerAppDiv.appendChild(emptyNavigableEl);

        // const pagesDiv = document.createElement('div');
        const pagesDiv = document.createElement('navigable-list');
        pagesDiv.setAttribute('class', 'pages');
        pagesDiv.setAttribute('data-nav-type', 'spatial');
        pagesDiv.setAttribute('data-nav-algorithm', 'spatial');
        pagesDiv.setAttribute('data-nav-history', 'true');
        playerAppDiv.appendChild(pagesDiv);

        const backgroundLayer1 = document.createElement('div');
        backgroundLayer1.setAttribute('id', PAGES_IDS.backgroundLayer1);
        backgroundLayer1.setAttribute('class', 'page');
        pagesDiv.appendChild(backgroundLayer1);

        const backgroundLayer0 = document.createElement('div');
        backgroundLayer0.setAttribute('id', PAGES_IDS.backgroundLayer0);
        backgroundLayer0.setAttribute('class', 'page');
        pagesDiv.appendChild(backgroundLayer0);

        const pageBridgeToKeepVideoHole = document.createElement('div');
        pageBridgeToKeepVideoHole.setAttribute('id', PAGES_IDS.pageBridgeToKeepVideoHole);
        pageBridgeToKeepVideoHole.setAttribute('class', 'page');
        pageBridgeToKeepVideoHole.style.zIndex = zIndex.PAGE_BRIDGE_TO_KEEP_VIDEO_HOLE;
        pagesDiv.appendChild(pageBridgeToKeepVideoHole);

        const globalBack1 = document.createElement('div');
        globalBack1.setAttribute('id', PAGES_IDS.globalBack1);
        globalBack1.setAttribute('class', 'page');
        pagesDiv.appendChild(globalBack1);

        const globalBack0 = document.createElement('div');
        globalBack0.setAttribute('id', PAGES_IDS.globalBack0);
        globalBack0.setAttribute('class', 'page');
        pagesDiv.appendChild(globalBack0);

        const pageLayer1 = document.createElement('div');
        pageLayer1.setAttribute('id', PAGES_IDS.pageLayer1);
        pageLayer1.setAttribute('class', 'page');
        pagesDiv.appendChild(pageLayer1);

        const pageLayer0 = document.createElement('div');
        pageLayer0.setAttribute('id', PAGES_IDS.pageLayer0);
        pageLayer0.setAttribute('class', 'page');
        pagesDiv.appendChild(pageLayer0);

        const globalFront1 = document.createElement('div');
        globalFront1.setAttribute('id', PAGES_IDS.globalFront1);
        globalFront1.setAttribute('class', 'page');
        pagesDiv.appendChild(globalFront1);

        const globalFront0 = document.createElement('div');
        globalFront0.setAttribute('id', PAGES_IDS.globalFront0);
        globalFront0.setAttribute('class', 'page');
        pagesDiv.appendChild(globalFront0);

        const loadingLayer = document.createElement('div');
        loadingLayer.setAttribute('id', PAGES_IDS.loadingLayer);
        loadingLayer.setAttribute('class', 'page loading-layer');
        loadingLayer.style.backgroundImage = `url("${filesystem.getIconPath()}loading.svg")`;
        loadingLayer.style.zIndex = zIndex.LOADING_LAYER;
        pagesDiv.appendChild(loadingLayer);

        playerWrapper.appendChild(playerAppDiv);

        return playerWrapper;
    }

    function runPlayer() {
        if (!PlayTimerController.isReady()) {
            setTimeout(runPlayer, 100);
        } else {
            logger.log('[PLAYER_INIT] 02. Now PlayTimerController is ready', 'vxtPlayback.js', 'blue');
            playbackPageManager
                .initialize()
                // .then(proxy.init())
                .then(() => {
                    logger.log(
                        '[PLAYER_INIT] 04. Now Player is Initialized, Waiting FrameSchedule',
                        'vxtPlayback.js',
                        'blue'
                    );
                    if (jobList.length) {
                        for (let i = 0; i < jobList.length; i++) {
                            JobHandler.assignJob(jobList[i]);
                        }
                    }
                    jobList = [];

                    if (utils.platformType.isBrowser()) {
                        JobHandler.assignPreviewJob();
                    }

                    const verWPlayer = wplayerVersion || 'wplayer-unknown';
                    const timestamp = wplayerTimestamp || 'timestamp-unknown';
                    const verNaCl = PlayTimerController.getVersion();
                    dispatchEvent({
                        type: 'wplayer:initialized',
                        level: 'info',
                        datetime: Date(),
                        version: `${verWPlayer}, ${verNaCl}`
                    });
                    console.log(`versions: ${verWPlayer}(${timestamp}), ${verNaCl}`);
                });
        }
    }

    function debugLog(debug) {
        try {
            logger.debug(debug.message, debug.module, debug.color);
        } catch (e) {
            logger.error(`wplayer.debugLog: Exception occurred ${JSON.stringify(e)}`, 'vxtPlayback.js');
            logger.error(`${e.stack}`, 'vxtPlayback.js', 'magenta', '109');
        }
    }

    function errorLog(error, key) {
        try {
            logger.error(
                `${error.module.replace('.js', '')}.${error.function}(): ` +
                    `Exception occurred = ${error.message} ${error.customMessage} ${error.stack}`,
                error.module,
                error.color,
                key
            );
        } catch (e) {
            logger.error(`wplayer.errorLog: Exception occurred ${JSON.stringify(e)}`, 'vxtPlayback.js');
            logger.error(`${e.stack}`, 'vxtPlayback.js', 'magenta', '109');
        }
    }

    function defaultLog(log, key) {
        try {
            logger.log(
                `${log.module.replace('.js', '')}.${log.function}(): ` +
                    `${log.message}${log.message ? ' ' : ''}${log.customMessage}`,
                log.module,
                log.color,
                key
            );
        } catch (e) {
            logger.error(`wplayer.defaultLog: Exception occurred ${JSON.stringify(e)}`, 'vxtPlayback.js');
            logger.error(`${e.stack}`, 'vxtPlayback.js', 'magenta', '109');
        }
    }

    // [FIX] subscribeEvents 중복 호출 방지
    // VxtPlayback()이 여러 번 생성될 경우 동일한 싱글톤(media, playTimer 등)에
    // 동일한 핸들러가 중복 등록되는 것을 방지
    function subscribeEvents() {
        if (_eventsSubscribed) {
            logger.log('[PLAYER_WARN] subscribeEvents already called, skipping duplicate subscription', 'vxtPlayback.js');
            return;
        }
        _eventsSubscribed = true;

        _eventSubscriptions.push(
            media.subscribe(media.eventBus.eventType.ERROR, (error) => {
                errorLog(error, '109');
            })
        );

        _eventSubscriptions.push(
            playTimer.subscribe(playTimer.eventBus.eventType.ERROR, (error) => {
                errorLog(error);
            })
        );

        _eventSubscriptions.push(
            filesystem.subscribe(filesystem.eventBus.eventType.ERROR, (error) => {
                errorLog(error, '109');
            })
        );

        _eventSubscriptions.push(
            media.subscribe(media.eventBus.eventType.DEBUG, (debug) => {
                debugLog(debug);
            })
        );

        _eventSubscriptions.push(
            playTimer.subscribe(playTimer.eventBus.eventType.DEBUG, (debug) => {
                debugLog(debug);
            })
        );

        _eventSubscriptions.push(
            media.subscribe(media.eventBus.eventType.LOG, (log) => {
                defaultLog(log, '109');
            })
        );

        _eventSubscriptions.push(
            playTimer.subscribe(playTimer.eventBus.eventType.LOG, (log) => {
                defaultLog(log);
            })
        );

        _eventSubscriptions.push(
            udpListener.subscribe(udpListener.eventBus.eventType.LOG, (log) => {
                defaultLog(log);
            })
        );

        _eventSubscriptions.push(
            udpListener.subscribe(udpListener.eventBus.eventType.ERROR, (error) => {
                errorLog(error);
            })
        );

        // proxy.subscribe(proxy.eventBus.eventType.LOG, (log) => {
        //     defaultLog(log);
        // });

        // proxy.subscribe(proxy.eventBus.eventType.ERROR, (error) => {
        //     errorLog(error);
        // });
    }

    initialize();
    createDom(parentEl);
    logger.log('[PLAYER_INIT] 01. Waiting PlayTimerController.isReady()', 'vxtPlayback.js', 'blue');
    runPlayer();
    subscribeEvents();
    intervalManager.getStats('plain');

    return {
        getPlayerEventEl() {
            return el;
        },
        // assignJob(data) {
        //     console.log('wplayer.assignJob: Job is assigned from outside');
        //     if (playbackPageManager.getInitializeStatus()) {
        //         JobHandler.assignJob(data);
        //     } else {
        //         if (jobList.length > 0) {
        //             const index = R.findIndex(R.propEq(data.type, 'type'))(jobList);
        //             if (index >= 0) {
        //                 jobList[index].data = data.data;
        //                 return;
        //             }
        //         }
        //         jobList.push(data);
        //     }
        // },
        getJobHandler() {
            console.log('wplayer.assignJob: Job is assigned from outside');
            // initialize() 호출후 true됨
            if (playbackPageManager.getInitializeStatus()) {
                return JobHandler;
            }

            // if (jobList.length > 0) {
            //     const index = R.findIndex(R.propEq(data.type, 'type'))(jobList);
            //     if (index >= 0) {
            //         jobList[index].data = data.data;
            //         return;
            //     }
            // }
            // jobList.push(data);
            return {};
        }
    };
}
