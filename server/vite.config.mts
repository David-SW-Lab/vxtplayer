import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, normalizePath, loadEnv, ViteDevServer } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import legacy from '@vitejs/plugin-legacy';
import chokidar from 'chokidar';
import tsChecker from 'vite-plugin-checker';

const resolvePath = (pathToFile: string): string =>
    normalizePath(path.resolve(__dirname, pathToFile));

const [platform, buildId]: string[] = fs
    .readFileSync(resolvePath('build-scripts/buildInfo.txt'), 'utf8')
    .split('\n');

const playbackPath = `node_modules/@vxt/playback/dist/es2015/${platform}`;
const assetsDefaultDir = `src/assets/vxplayer/default`;
const platformPublic = `src/utils/platform/${platform}/public`;

const copyPaths = [
    {
        src: [
            resolvePath(`${platformPublic}/**/!(index.html)`),
            resolvePath('src/assets/etc/**/*'),
            resolvePath(`${playbackPath}/play-timer/*`),
            resolvePath(`${playbackPath}/play-timer-wasm/*`),
            resolvePath('libs/rmplayer/build/rmplayer.android.js') // for android rm web view (ignored if it does not exist)
        ],
        dest: './'
    },
    {
        src: [
            resolvePath(`${assetsDefaultDir}/default.mp4`),
            resolvePath(`${assetsDefaultDir}/default_portrait.mp4`),
            resolvePath(`${assetsDefaultDir}/default.png`),
            resolvePath(`${assetsDefaultDir}/default_portrait.png`),
            resolvePath(`${assetsDefaultDir}/default_knox.png`),
            resolvePath(`${assetsDefaultDir}/default_knox_portrait.png`),
            resolvePath(`${assetsDefaultDir}/default_knox_epaper.png`),
            resolvePath(`${assetsDefaultDir}/default_knox_epaper_portrait.png`),
            resolvePath(`${assetsDefaultDir}/default_content_epaper.png`),
            resolvePath(
                `${assetsDefaultDir}/default_content_epaper_portrait.png`
            )
        ],
        dest: 'assets/default'
    },
    {
        src: resolvePath(`${playbackPath}/resource/*`),
        dest: 'assets/wplayer_resources'
    },
    {
        src: resolvePath('src/assets/imgs/message-background'),
        dest: 'assets/imgs'
    },
    {
        src: resolvePath('src/assets/locales'),
        dest: 'assets'
    }
];

const watchPlaybackChanges = () => {
    /*
       like said in vite docs https://vitejs.dev/config/server-options.html#server-watch
       it is not possible to watch files in node_modules and proposed workaround does not work
       for playback because of mixed commonjs and esm codebase.

       This "watch-playback-changes" plugin detects changes in playback and restarts server
       to re-bundle cached optimized dependencies
    */
    return {
        name: 'watch-playback-changes',
        configureServer: (server: ViteDevServer) => {
            chokidar
                .watch(playbackPath, { cwd: process.cwd() })
                .on('change', async () => {
                    // TODO: find a way to re-bundle only playback code instead of re-bundling all optimized dependencies
                    await server.restart();
                });
        }
    };
};

const injectDevScript = (serveUrl: string) => {
    return {
        name: 'html-transform',
        transformIndexHtml(html: string) {
            const scriptStr = fs
                .readFileSync(
                    resolvePath('build-scripts/dev-mode-script.js'),
                    'utf8'
                )
                .replace(/\{{serveUrl}}/g, serveUrl);
            const devScript = `<script>\n${scriptStr}</script>`;
            const splitStr = '</body>';
            const [start, end] = html.split(splitStr);
            return start + devScript + '\n' + splitStr + end;
        }
    };
};

/**
 * [HOT SWAP] Vite 플러그인: 빌드된 index.html의 메인 스크립트 태그를
 * 서버 우선 / 로컬 fallback 로더로 교체합니다.
 *
 * 동작:
 * 1. 앱 시작 시 `baseServerUrl/index.js` 에 HEAD 요청
 * 2. HTTP 200 응답 → 서버 파일 동적 로드
 * 3. 404 / 네트워크 오류 / 5초 타임아웃 → 로컬 빌드 파일 로드
 *
 * 활성화 조건: isTizen && !isDev && tizenSettings.defaultServerUrl 설정됨
 */
const injectServerFallbackLoader = (baseServerUrl: string) => {
    const serverJsUrl = `${baseServerUrl}/index.js`;
    return {
        name: 'server-fallback-loader',
        transformIndexHtml: {
            enforce: 'post' as const,
            transform(html: string) {
                // Match the main entry script tag (module or nomodule) referencing an index JS file
                const scriptMatch = html.match(
                    /<script([^>]*)\bsrc="([^"]*\/index[^"]*\.js)"([^>]*)><\/script>/
                );
                if (!scriptMatch) return html;

                const [fullTag, attrsBefore, localSrc, attrsAfter] = scriptMatch;
                const allAttrs = attrsBefore + attrsAfter;
                const isModule = /\btype=["']module["']/.test(allAttrs);
                const isNoModule = /\bnomodule\b/.test(allAttrs);

                const scriptTypeAttr = isModule
                    ? "s.setAttribute('type','module');"
                    : isNoModule
                    ? "s.setAttribute('nomodule','');"
                    : '';

                const loader = `<script>
(function(){
  var serverUrl='${serverJsUrl}';
  var localUrl='${localSrc}';
  function load(src){
    var s=document.createElement('script');
    ${scriptTypeAttr}
    s.src=src;
    document.head.appendChild(s);
  }
  var x=new XMLHttpRequest();
  x.timeout=5000;
  x.onload=function(){load(x.status===200?serverUrl:localUrl);};
  x.onerror=function(){load(localUrl);};
  x.ontimeout=function(){load(localUrl);};
  x.open('HEAD',serverUrl);
  x.send();
})();
</script>`;

                return html.replace(fullTag, loader);
            }
        }
    };
};

const setupPlatformIndexHtml = () => {
    return {
        name: 'setup-entry',
        buildStart() {
            fs.cpSync(
                path.join(__dirname, platformPublic, 'index.html'),
                'index.html'
            );
        }
    };
};

const buildTimeStamp = (): string => {
    const date = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `D${y}${m}${d}.T${h}${min}${s}`;
};

export default defineConfig(async ({ mode }) => {
    const env: Record<string, string> = loadEnv(mode, process.cwd());
    const packageJson = await import('./package.json');
    const playbackPackageJson = await import(
        './node_modules/@vxt/playback/package.json'
    );
    const isWeb: boolean = platform === 'web';
    const isBrightSign: boolean =
        env.VITE_ELECTRON_SUBPLATFORM === 'brightsign';
    const isWindows: boolean = env.VITE_ELECTRON_SUBPLATFORM === 'windows';
    const isLinux: boolean = env.VITE_ELECTRON_SUBPLATFORM === 'linux';
    const isAndroid: boolean = platform === 'android';
    const isTizen: boolean = platform === 'tizen';

    // Only import tizen-settings when building for Tizen platform
    let tizenSettings = { requiredVersion: '6.5', defaultServerUrl: '' };
    if (isTizen) {
        try {
            tizenSettings = await import(`./settings/tizen-settings.js`);
        } catch (e) {
            // If tizen-settings.js doesn't exist, use default values
            console.warn('tizen-settings.js not found, using default values');
        }
    }
    const isLegacyTizen: boolean =
        isTizen && tizenSettings.requiredVersion === '4.0';
    const isDev: boolean = env.VITE_IS_DEV === 'true';
    const useDevScript: boolean = env.VITE_INJECT_DEV_SCRIPT === 'true';
    const isDevServerRunning: boolean = mode === 'development';
    const versionSuffix: string = (() => {
        if (isWeb) return 'V';
        if (isBrightSign) return 'B';
        if (isWindows || isLinux) return 'W';
        if (isAndroid) return 'A';
        if (isLegacyTizen) return 'L';
        return '';
    })();

    return {
        base: '', // sets correct path to assets in <outputDir>/index.html
        define: {
            BUILD_TIMESTAMP: JSON.stringify(buildTimeStamp()),
            PLAYER_BUILD_ID: JSON.stringify(buildId),
            APP_VERSION: JSON.stringify(packageJson.version + versionSuffix),
            WINE_VERSION: JSON.stringify(
                playbackPackageJson.dependencies['@supernova/wine-api'] || ''
            ).replace('^', ''),
            BUNDLE_VERSION: JSON.stringify(
                isTizen
                    ? (
                          await import(
                              `./build-scripts/get-next-bundle-version.js`
                          )
                      ).default(fs, path, tizenSettings, packageJson.version)
                    : packageJson.version
            ),
            INLINED_DEFAULT_SERVER_URL: JSON.stringify(
                tizenSettings.defaultServerUrl
            )
        },
        plugins: [
            setupPlatformIndexHtml(),
            tsChecker({ typescript: true }),
            viteTsconfigPaths(),
            viteStaticCopy({
                targets: copyPaths
            }),
            nodePolyfills({
                globals: {
                    Buffer: true,
                    global: true,
                    process: true
                }
            }),
            (isBrightSign || isLegacyTizen || isAndroid) &&
                legacy({
                    targets: [
                        'chrome>=54',
                        '>0.2%',
                        'not dead',
                        'not op_mini all'
                    ],
                    renderModernChunks: false
                }),
            useDevScript &&
                injectDevScript(`http://${env.VITE_HOST}:${env.VITE_PORT}/`),
            isDevServerRunning && watchPlaybackChanges(),
            // [HOT SWAP] 서버에 index.js 있으면 서버 파일 우선 로드, 없으면 로컬 빌드 파일 사용
            isTizen && !isDev && tizenSettings.defaultServerUrl && injectServerFallbackLoader(tizenSettings.defaultServerUrl)
        ],
        server: {
            open: false,
            port: Number(env.VITE_PORT),
            host: env.VITE_HOST
        },
        build: {
            outDir: env.VITE_BUILD_DIRECTORY,
            minify: !isDev,
            sourcemap: isDev ? 'inline' : false,
        },
        optimizeDeps: {
            force: true
        }
    };
});
