const UNAPPROPRIATE_TIME = 60000; // Thursday, January 1, 1970 12:01:00 AM

// [FIX] 재귀 setTimeout → setInterval 교체
// 기존: 조건 충족 전까지 1초마다 새 setTimeout을 재귀 생성 → 참조가 사라진 setTimeout이 계속 쌓임
// 수정: setInterval 하나를 유지하고, 조건 충족 시 clearInterval로 정리
export const monitoringAppropriateTime = (resolve) => {
    const id = setInterval(() => {
        if (Date.now() > UNAPPROPRIATE_TIME) {
            clearInterval(id);
            resolve();
        }
    }, 1000);
    return id;
};

export default function kernelTimeMonitoring() {
    console.log('[VXINIT] kernelTimeMonitoring');
    return new Promise((resolve) => {
        monitoringAppropriateTime(resolve);
    });
}
