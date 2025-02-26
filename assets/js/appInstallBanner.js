let deferredPrompt;
const installBanner = document.createElement('div');
installBanner.id = 'install-banner';
installBanner.innerHTML = `
    <p>Installiere unsere App für ein besseres Erlebnis!</p>
    <button id="install-button">Jetzt installieren</button>
    <span id="close-install-banner" style="cursor: pointer; font-weight: bold;">&times;</span>
`;

document.body.appendChild(installBanner);
installBanner.style.display = 'none';  // Standardmäßig unsichtbar

const installButton = document.getElementById('install-button');
const closeBannerButton = document.getElementById('close-install-banner');

// Installationsaufforderung für Android und Desktop (Windows/Mac)
if (window.matchMedia('(display-mode: standalone)').matches === false) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBanner.style.display = 'block';  // Zeigt den Banner an

        // Installationsbutton click
        installButton.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
                installBanner.style.display = 'none';
            });
        });

        // Schließen des Banners
        closeBannerButton.addEventListener('click', () => {
            installBanner.style.display = 'none';
        });
    });
}

// iOS-spezifische Hinweise
if (navigator.userAgent.includes('iPhone') && !window.matchMedia('(display-mode: standalone)').matches) {
    const iosInstallBanner = document.createElement('div');
    iosInstallBanner.id = 'ios-install-banner';
    iosInstallBanner.innerHTML = `
        <p>Fügen Sie diese Seite zum Home-Bildschirm hinzu, um sie wie eine App zu nutzen.</p>
        <button onclick="document.getElementById('ios-install-banner').style.display='none'">Schließen</button>
    `;
    document.body.appendChild(iosInstallBanner);

    iosInstallBanner.style.display = 'block';  // Zeigt den iOS-Banner an
}

// Wenn die App installiert wurde
window.addEventListener('appinstalled', () => {
    console.log('App wurde installiert');
    installBanner.style.display = 'none';
    if (document.getElementById('ios-install-banner')) {
        document.getElementById('ios-install-banner').style.display = 'none';
    }
});
