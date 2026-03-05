// Class Creator //-------------------------------------------------------------
import { logger, utils } from '../platform/platform-api';
import dispatchEvent from '../util/WSchedulerProxy';

function CallbackTimer() {
    let instance;

    function init() {
        const GlobalListeners = [];
        const GeneralListeners = [];
        const protectedGeneralListeners = [];
        const milliSecGeneralListeners = [];
        const milliSecProtectedListeners = [];
        let debugDiv;
        let oldTime = 0;
        let elapsedPagesPlayTime = 0;
        let playTime = 0;
        let networkDelayUpdateCount = 0;
        let customVideoPreparingTime = 0;
        const debugType = 'default';
        const NETWORK_UPDATE_LIMIT = 30; // about 30 sec
        function createDebugWindow() {
            const div0 = document.createElement('div');
            const div1 = document.createElement('div');

            debugDiv = document.createElement('div');
            debugDiv.setAttribute('id', 'debug');
            debugDiv.setAttribute('class', 'debug');
            debugDiv.setAttribute('style', 'visibility:hidden;');

            div0.setAttribute('id', 'totaltime');
            div0.setAttribute('class', `debug_${debugType}`);
            debugDiv.appendChild(div0);

            div1.setAttribute('id', 'timeattack');
            div1.setAttribute('class', `debug_${debugType}`);
            debugDiv.appendChild(div1);

            document.body.insertBefore(debugDiv, document.body.firstChild);
        }

        function convertIntToIP(ipInt) {
            // eslint-disable-next-line no-bitwise
            return [(ipInt >> 24) & 0xff, (ipInt >> 16) & 0xff, (ipInt >> 8) & 0xff, ipInt & 0xff].join('.');
        }

        function sendNetworkDelay(asset) {
            dispatchEvent({
                type: 'wplayer:networkDelay',
                data: asset
            });
        }

        function sendMasterId(asset) {
            dispatchEvent({
                type: 'wplayer:masterId',
                data: asset
            });
        }

        if (!utils.platformType.isBrowser()) {
            createDebugWindow();
        }

        return {
            addListener(time, self, callback) {
                // Listener has list of callback functions to execute at each time
                // switchTime: switch or play time of callback function
                // element: object to play
                // callback: function to execute
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                GeneralListeners.push(listener);
            },
            addProtectedListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                protectedGeneralListeners.push(listener);
            },
            addGlobalListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                GlobalListeners.push(listener);
            },
            addMilliSecGeneralListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                milliSecGeneralListeners.push(listener);
            },
            addMilliSecProtectedListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                milliSecProtectedListeners.push(listener);
            },
            removeListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };

                for (let i = GeneralListeners.length - 1; i >= 0; i--) {
                    if (
                        listener.switchTime === GeneralListeners[i].switchTime &&
                        listener.element === GeneralListeners[i].element &&
                        listener.callback === GeneralListeners[i].callback
                    ) {
                        GeneralListeners.splice(i, 1);
                    }
                }
            },
            removeGlobalListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };

                for (let i = GlobalListeners.length - 1; i >= 0; i--) {
                    if (
                        listener.switchTime === GlobalListeners[i].switchTime &&
                        listener.element === GlobalListeners[i].element &&
                        listener.callback === GlobalListeners[i].callback
                    ) {
                        GlobalListeners.splice(i, 1);
                    }
                }
            },
            removeMilliSecGeneralListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
                for (let i = milliSecGeneralListeners.length - 1; i >= 0; i--) {
                    if (
                        listener.switchTime === milliSecGeneralListeners[i].switchTime &&
                        listener.element === milliSecGeneralListeners[i].element &&
                        listener.callback === milliSecGeneralListeners[i].callback
                    ) {
                        milliSecGeneralListeners.splice(i, 1);
                    }
                }
            },
            // [FIX] 누락된 removeMilliSecProtectedListener 추가
            // 기존: addMilliSecProtectedListener만 있고 제거 메서드가 없어 배열이 무한 증가
            // WatchDog이 100ms마다 milliSecProtectedListeners에 추가하는데 제거가 불가능했음
            removeMilliSecProtectedListener(time, self, callback) {
                const listener = {
                    switchTime: time,
                    element: self,
                    callback
                };
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
            clearGeneralListeners() {
                GeneralListeners.length = 0;
            },
            clearGlobalListeners() {
                GlobalListeners.length = 0;
            },
            clearMilliSecGeneralListeners() {
                milliSecGeneralListeners.length = 0;
            },
            // [FIX] 누락된 clearMilliSecProtectedListeners 추가
            clearMilliSecProtectedListeners() {
                milliSecProtectedListeners.length = 0;
            },
            showCurrentStatus(pageIndex, timeTick, elapsed) {
                const text = document.getElementById('timeattack').innerHTML;
                document.getElementById(
                    'timeattack'
                ).innerHTML = `${text}<br> pageIndex: ${pageIndex} <br> timeTick: ${utils.numberFormat(
                    timeTick
                )} <br> elapsed: ${utils.numberFormat(elapsed)}`;
            },
            setPlayTime(timeInfo, _elapsedPagesPlayTime, syncInfo = false) {
                // const info = R.split(':')(timeInfo.toString());
                let timeTick = 0;
                if (!syncInfo) {
                    timeTick = parseInt(timeInfo, 10);
                }

                let isMaster;
                let expectedTime;
                let elapsedTime = _elapsedPagesPlayTime;
                let syncMessage;
                let masterFaster = 0;
                if (syncInfo) {
                    timeTick = parseInt(syncInfo.playTime, 10);
                    elapsedTime = syncInfo.elapsedTime;
                    isMaster = parseInt(syncInfo.isMaster, 10);
                    expectedTime = parseInt(syncInfo.expectedTime, 10);
                    masterFaster = parseInt(syncInfo.diffFromMaster, 10);
                    const currentTime = Date.now();
                    const masterClock = isMaster ? currentTime : parseInt(syncInfo.masterTime, 10);
                    const fixedTime = currentTime + masterFaster;
                    const myIp = convertIntToIP(parseInt(syncInfo.myIp, 10));
                    let masterIp = isMaster ? '' : convertIntToIP(parseInt(syncInfo.masterIp, 10));
                    syncMessage =
                        `<br> custom time  : ${utils.numberFormat(customVideoPreparingTime)} ms` +
                        `<br> isMaster     : ${isMaster ? `${isMaster} ==========` : isMaster}` +
                        `<br>` +
                        `<br> master time   &nbsp;&nbsp;&nbsp;: ${utils.numberFormat(masterClock)}` +
                        `<br> fixed time   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${utils.numberFormat(
                            fixedTime
                        )}` +
                        `<br> received time &nbsp;: ${utils.numberFormat(syncInfo.packetReceivedTime)}` +
                        `<br> master-sub   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${utils.numberFormat(masterFaster)}` +
                        `<br> MyIP: ${myIp} / MasterIP: ${masterIp}` +
                        `<br> UDP_RETRY_COUNT : ${syncInfo.retryCount}/${syncInfo.retryMax}`;

                    if (isMaster) {
                        syncMessage += `<br> WS_RETRY_COUNT : ${syncInfo.webSocketState.requestSuccessCount}`;
                    }

                    if (isMaster) {
                        if (++networkDelayUpdateCount >= NETWORK_UPDATE_LIMIT) {
                            sendNetworkDelay({ networkDelay: syncInfo.minNetworkDelay });
                            networkDelayUpdateCount = 0;
                        }
                        syncMessage += `<br> MIN_NETWORK_DELAY : ${utils.numberFormat(syncInfo.minNetworkDelay)}`;
                    }

                    masterIp = convertIntToIP(parseInt(syncInfo.masterIp, 10));
                    logger.log(
                        `[SYNC_INFO] masterTime: ${masterClock}, fixedTime: ${fixedTime}, masterFaster: ${masterFaster}, isMaster: ${isMaster}, MyIP: ${myIp}, MasterIP: ${masterIp}`
                    );
                }

                if (timeTick < 0) {
                    /* eslint-disable no-param-reassign */
                    timeTick = 0;
                }

                elapsedPagesPlayTime = _elapsedPagesPlayTime;
                playTime = timeTick;

                utils.setDiffFromMaster(masterFaster);

                for (let i = 0; i < milliSecGeneralListeners.length; i++) {
                    milliSecGeneralListeners[i].callback(timeTick, milliSecGeneralListeners[i].element, expectedTime);
                }

                for (let i = 0; i < milliSecProtectedListeners.length; i++) {
                    milliSecProtectedListeners[i].callback(timeTick, milliSecProtectedListeners[i].element);
                }

                const timeSEC = parseInt(timeTick / 1000, 10);
                if (timeSEC !== oldTime) {
                    if (timeSEC !== 0) {
                        for (let i = 0; i < GeneralListeners.length; i++) {
                            if (timeSEC % GeneralListeners[i].switchTime === 0) {
                                GeneralListeners[i].callback(timeSEC);
                            }
                        }
                        for (let i = 0; i < protectedGeneralListeners.length; i++) {
                            if (timeSEC % protectedGeneralListeners[i].switchTime === 0) {
                                protectedGeneralListeners[i].callback(timeSEC);
                            }
                        }
                        for (let i = 0; i < GlobalListeners.length; i++) {
                            if (timeSEC % GlobalListeners[i].switchTime === 0) {
                                GlobalListeners[i].callback(timeSEC);
                            }
                        }
                    }

                    let backgroundColor = 'green';
                    if (document.getElementById('timeattack') !== null) {
                        if (document.getElementById('debug').style.visibility === 'visible') {
                            if ((expectedTime / 1000) % 2 === 0) {
                                backgroundColor = isMaster ? 'gold' : 'green';
                            } else {
                                backgroundColor = isMaster ? 'purple' : 'blue';
                            }
                            document.getElementById('debug').style.backgroundColor = backgroundColor;
                            document.getElementById('timeattack').innerHTML = `${`${utils.numberFormat(timeTick)} ms` +
                                '<br>' +
                                `elapsed    : ${utils.numberFormat(elapsedTime)}`}${syncMessage || ''}`;
                        }
                    }
                }
                oldTime = timeSEC;
            },
            getElapsedPagesPlayTime() {
                return elapsedPagesPlayTime;
            },
            getPlayTime() {
                return playTime;
            },
            setCustomVideoPreparingTime(customTime) {
                customVideoPreparingTime = customTime;
            },
            setPlayerInfo(playerInfo) {
                logger.log(`[PLAYER_INFO] - playerInfo.masterId: ${playerInfo.masterId}`);
                sendMasterId({ masterId: playerInfo.masterId });
            }
        };
    }

    return {
        // Get the Singleton instance if one exists
        // or create one if it doesn't
        getInstance() {
            if (!instance) {
                instance = init();
            }

            return instance;
        }
    };
}

const callbackTimer = new CallbackTimer();
const callbackTimerInstance = callbackTimer.getInstance();

export default callbackTimerInstance;
