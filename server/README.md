# VXTPlayer 서버 JS 핫 교체 (Server-side JS Hot Swap)

## 개요

Tizen 빌드 시 생성되는 번들 JS 파일을 **재빌드 없이 서버에서 즉시 교체**할 수 있는 기능입니다.

앱 시작 시 지정된 서버 URL에 `index.js`가 존재하는지 확인합니다:
- **서버에 파일 있음** → 서버 파일 로드 (빌드 없이 즉시 적용)
- **서버에 파일 없음 / 응답 없음** → 로컬 빌드 파일 로드 (기존 동작)

---

## 동작 원리

`npm run tizen:build` 실행 시, `vite.config.mts`의 `injectServerFallbackLoader` 플러그인이
Vite가 생성한 `index.html` 안의 `<script src="assets/index-{hash}.js">` 태그를
아래와 같은 동적 loader 스크립트로 교체합니다:

```html
<script>
(function(){
  var serverUrl='http://192.168.250.1:3000/index.js';  // settings의 defaultServerUrl
  var localUrl='assets/index-abc123.js';               // 로컬 빌드 파일

  function load(src){
    var s=document.createElement('script');
    s.setAttribute('type','module');
    s.src=src;
    document.head.appendChild(s);
  }

  var x=new XMLHttpRequest();
  x.timeout=5000;
  x.onload=function(){load(x.status===200?serverUrl:localUrl);};
  x.onerror=function(){load(localUrl);};
  x.ontimeout=function(){load(localUrl);};
  x.open('HEAD',serverUrl);  // HEAD 요청으로 파일 존재 여부만 확인
  x.send();
})();
</script>
```

---

## 설정

`settings/tizen-settings.js`의 `defaultServerUrl`이 서버 주소로 사용됩니다:

```js
module.exports = {
    defaultServerUrl: 'http://192.168.250.1:3000',  // 이 주소의 /index.js 를 확인
    // ...
};
```

> `defaultServerUrl`이 빈 문자열이면 loader가 주입되지 않고 기존 방식 그대로 동작합니다.

---

## 서버 실행 방법

이 폴더의 `server.js`를 사용하면 간단하게 정적 파일 서버를 실행할 수 있습니다.

```bash
cd server
node server.js
```

기본 포트: **3000**
서버가 실행되면 `http://{host}:3000/index.js` 경로에 교체할 JS 파일을 올려두면 됩니다.

### JS 파일 교체 방법

1. 교체할 빌드 JS 파일(`assets/index-{hash}.js`)을 `index.js`로 이름 변경
2. `server/` 폴더의 `public/` 디렉토리에 복사
3. Tizen TV를 재시작하면 서버의 `index.js`를 로드

---

## 주의사항

- **CORS**: Tizen 앱에서 외부 서버 JS를 로드할 때 CORS 헤더가 필요합니다 (`server.js`에 이미 포함)
- **개발 빌드 제외**: `tizen:buildOnly` (VITE_IS_DEV=true) 로 빌드 시에는 loader가 주입되지 않음
- **타임아웃**: 서버 응답이 5초 내에 없으면 로컬 파일로 자동 fallback

---

## 변경된 파일

- `vite.config.mts` — `injectServerFallbackLoader` Vite 플러그인 추가 ([전체 파일 보기](./vite.config.mts))
