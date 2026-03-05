/**
 * @file message-container
 * @author Piotr Nowacki (p.nowacki@samsung.com)
 * @date 2018-09-04
 * @description Message container connects to the store and updates UI message.
 * @copyright Copyright (c) 2018 Samsung Electronics, Visual Display Division. All Rights Reserved.
 */

import * as R from 'ramda';
import { animationFrames, useComponentInit$ } from 'utils/rxjs';
import { map, filter } from 'rxjs/operators';
import { subscribeStorage } from 'redux-partial-subscribe';
import { div } from 'utils/elements';
import { cacheState } from 'utils/local-storage-utils';
import { messageQueue } from 'utils/timeline/timeline';
import * as logger from 'modules/logger/log-collector';
import appStore from 'app-store';
import messageComponent from './message';
import {
    getBaseVxServerUrl,
    getInfoLinkServerTypeIndex
} from 'initialize-utils';
import { getFontFilePath } from 'platform';
import { messageDisplayEnabled } from 'components/message/message-redux';
import { getMessagePlayMode } from 'utils/store-utils';

// [FIX] 모듈 레벨 구독 관리
// messageContainer()가 여러 번 호출될 경우 animationFrames 구독이 중복 생성되어
// 60fps마다 여러 콜백이 실행되는 것을 방지
let _activeSubscription = null;

export default function messageContainer() {
    // 기존 구독이 있으면 먼저 해제
    if (_activeSubscription) {
        _activeSubscription.unsubscribe();
        _activeSubscription = null;
    }

    const state = {
        el: undefined,
        storedMessages: [],
        currentMessageStopTime: 0
    };

    const render = (data = {}) =>
        div({ id: 'message-layer' }, data.cdata ? messageComponent(data) : '');

    const update = (prevEl) => (data) => {
        const newEl = render(data);
        prevEl.parentElement.replaceChild(newEl, prevEl);
        useComponentInit$.next(newEl.firstChild);
        state.el = newEl;
    };

    const updateMessage = (currentTime) => {
        if (!state.el || state.storedMessages.length === 0) {
            return;
        }

        const currentState = appStore.getState();
        if (!currentState.message?.displayEnabled) {
            return;
        }

        R.pipe(
            messageQueue,
            R.tap((messages) =>
                logger.log('[components/message] message queue', messages)
            ),
            R.prop('messageToBeDisplayed'),
            R.tap((message) => {
                if (message && message.stopTime) {
                    state.currentMessageStopTime = message.stopTime;
                }
            }),
            update(state.el)
        )(state.storedMessages, currentTime);
    };
    subscribeStorage('message', ({ next }) => {
        // Only store messages, display only when displayEnabled is true
        // Ensure storedMessages is always an array to prevent iterable errors
        state.storedMessages = next?.messages || [];
        cacheState(appStore.getState());
    });

    subscribeStorage('message.fontFiles', ({ next }) => {
        if (!next) return;

        const existingStyleElement = document.querySelector('style.tickerFont');
        if (existingStyleElement) {
            existingStyleElement.remove();
        }
        const customFontStyle = document.createElement('style');
        customFontStyle.className = 'tickerFont';

        const rules = next.map(
            (fontFile) =>
                `@font-face {
        font-family: '${fontFile.fileName.replace(/\.[^/.]+$/, '')}';
        src: url('${getFontFilePath(
            fontFile,
            getBaseVxServerUrl(getInfoLinkServerTypeIndex())
        )}');
    }`
        );
        customFontStyle.textContent = rules.join('');
        document.head.appendChild(customFontStyle);
        if (getMessagePlayMode(appStore.getState()) !== 'EVENTS') {
            appStore.dispatch(messageDisplayEnabled(true));
        }
    });

    subscribeStorage('message.displayEnabled', ({ next }) => {
        if (next) {
            // When displayEnabled becomes true, start displaying message
            // Display immediately and set currentMessageStopTime for continuous updates
            state.currentMessageStopTime = Date.now();
            updateMessage(Date.now());
        } else {
            // When displayEnabled becomes false, stop displaying message
            state.currentMessageStopTime = 0;
            // Remove message from DOM (update with empty message)
            if (state.el) {
                update(state.el)({});
            }
        }
    });

    const changeMessage$ = animationFrames(Date).pipe(
        filter(() => state.currentMessageStopTime),
        map(R.prop('timestamp')),
        filter((currentTime) => state.currentMessageStopTime < currentTime)
    );

    // [FIX] 구독 반환값을 모듈 레벨 변수에 저장하여 다음 호출 시 해제 가능하도록 함
    _activeSubscription = changeMessage$.subscribe((timestamp) => {
        updateMessage(timestamp);
    });

    state.el = render();

    return state.el;
}
