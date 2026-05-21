// PWA支援処理: Service Worker登録と通信状態表示
document.addEventListener('DOMContentLoaded', () => {
    const networkStatus = document.getElementById('networkStatus');

    function updateNetworkStatus() {
        if (!networkStatus) return;
        if (navigator.onLine) {
            networkStatus.textContent = '';
            networkStatus.classList.remove('visible');
        } else {
            networkStatus.textContent = 'オフラインです。アプリは開けますが、翻訳には通信が必要です。';
            networkStatus.classList.add('visible');
        }
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Workerはこのブラウザで利用できません');
            return;
        }

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('Service Worker登録完了:', registration.scope);
                })
                .catch((error) => {
                    console.warn('Service Worker登録失敗:', error);
                });
        });
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
    registerServiceWorker();
});
