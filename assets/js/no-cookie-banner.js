/**
 * No-Cookie Banner
 * A humorous banner since we don't use cookies anyway
 */

class NoCookieBanner {
    constructor() {
        this.storageKey = 'noCookieBannerAccepted';
        this.init();
    }

    init() {
        // Check if banner was already accepted
        if (this.isAccepted()) {
            return;
        }

        // Wait a bit before showing the banner
        setTimeout(() => {
            this.showBanner();
        }, 1000);
    }

    isAccepted() {
        return localStorage.getItem(this.storageKey) === 'true';
    }

    showBanner() {
        const banner = document.createElement('div');
        banner.id = 'no-cookie-banner';
        banner.className = 'no-cookie-banner';
        banner.innerHTML = this.createBannerHTML();
        document.body.appendChild(banner);

        // Animate in
        requestAnimationFrame(() => {
            banner.classList.add('no-cookie-banner--visible');
        });

        // Setup event listeners
        this.setupEventListeners(banner);
    }

    createBannerHTML() {
        const t = (key, fallback) => {
            if (window.i18n?.t) {
                const translation = window.i18n.t(key);
                if (translation && translation !== key) {
                    return translation;
                }
            }
            return fallback;
        };

        return `
            <div class="no-cookie-banner__content">
                <div class="no-cookie-banner__icon">
                    <i class='bx bx-cookie'></i>
                </div>
                <div class="no-cookie-banner__text">
                    <h3 class="no-cookie-banner__title" data-i18n="noCookie.title">
                        ${t('noCookie.title', 'Keine Cookies hier! 🍪')}
                    </h3>
                    <p class="no-cookie-banner__description" data-i18n="noCookie.description">
                        ${t('noCookie.description', 'Wir nutzen keine Cookies. Stattdessen stimmst du zu, dass du diese Website aufmerksam liest und mir einen Stern auf GitHub gibst. Fair?')}
                    </p>
                </div>
                <div class="no-cookie-banner__actions">
                    <button class="no-cookie-banner__button no-cookie-banner__button--accept" data-i18n="noCookie.accept">
                        ${t('noCookie.accept', 'Klar, mache ich!')}
                    </button>
                    <button class="no-cookie-banner__button no-cookie-banner__button--decline" data-i18n="noCookie.decline">
                        ${t('noCookie.decline', 'Nö, keine Lust')}
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners(banner) {
        const acceptBtn = banner.querySelector('.no-cookie-banner__button--accept');
        const declineBtn = banner.querySelector('.no-cookie-banner__button--decline');

        acceptBtn?.addEventListener('click', () => {
            this.accept(banner);
        });

        declineBtn?.addEventListener('click', () => {
            this.decline(banner);
        });

        // Apply i18n translations
        if (window.i18n?.applyTranslations) {
            window.i18n.applyTranslations();
        }
    }

    accept(banner) {
        localStorage.setItem(this.storageKey, 'true');
        this.hideBanner(banner);

        // Open GitHub follow page in new tab
        setTimeout(() => {
            window.open('https://github.com/users/FaserF/follow', '_blank', 'noopener,noreferrer');
        }, 300);
    }

    decline(banner) {
        // Even if declined, we don't use cookies anyway, so just hide it
        localStorage.setItem(this.storageKey, 'true');
        this.hideBanner(banner);
    }

    hideBanner(banner) {
        banner.classList.remove('no-cookie-banner--visible');
        banner.classList.add('no-cookie-banner--hiding');

        setTimeout(() => {
            banner.remove();
        }, 300);
    }
}

// Initialize when DOM is ready
(function() {
    const init = () => {
        if (typeof window.noCookieBanner === 'undefined') {
            window.noCookieBanner = new NoCookieBanner();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
