/**
 * System Status Checker
 * Checks availability of systems and displays their status
 */

class SystemStatus {
    constructor() {
        this.systems = [
            {
                name: 'Home Assistant',
                url: 'https://ha.fabiseitz.de',
                isPrivate: true,
                github: 'https://github.com/home-assistant/core',
                category: 'thirdParty'
            },
            {
                name: 'Bitwarden',
                url: 'https://pw.fabiseitz.de',
                isPrivate: true,
                github: 'https://github.com/bitwarden/server',
                category: 'thirdParty'
            },
            {
                name: 'Paperless NGX',
                url: 'https://docs.fabiseitz.de',
                isPrivate: true,
                github: 'https://github.com/paperless-ngx/paperless-ngx',
                category: 'thirdParty'
            },
            {
                name: 'Wiki.JS',
                url: 'https://wiki.fabiseitz.de',
                isPrivate: false,
                github: 'https://github.com/requarks/wiki',
                category: 'thirdParty'
            },
            {
                name: 'Solumati',
                url: 'https://solumati.fabiseitz.de',
                isPrivate: false,
                github: 'https://github.com/FaserF/Solumati',
                category: 'myProjects'
            },
            {
                name: 'faneX-ID',
                url: 'https://fanex-id.fabiseitz.de',
                isPrivate: false,
                github: 'https://fanex-id.github.io/',
                category: 'myProjects'
            },
            {
                name: 'Private DNS Proxy',
                url: 'https://doh.fabiseitz.de',
                isPrivate: true,
                github: 'https://github.com/FaserF/ShieldDNS',
                category: 'myProjects'
            },
            {
                name: 'Aegis Telegram Bot Manager',
                url: 'https://aegis.fabiseitz.de',
                isPrivate: false,
                github: 'https://github.com/FaserF/aegisbot',
                category: 'myProjects'
            }
        ];
        this.statusData = new Map();
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.init();
    }

    async init() {
        this.updateLastUpdateTime();
        await this.checkAllSystems();
        this.renderStatus();
        this.startAutoRefresh();
    }

    updateLastUpdateTime() {
        const updateEl = document.getElementById('status-last-update');
        if (updateEl) {
            const now = new Date();
            const locale = this.getLocale();
            updateEl.textContent = now.toLocaleString(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    getLocale() {
        if (window.i18n?.currentLang) {
            return window.i18n.currentLang === 'de' ? 'de-DE' : 'en-US';
        }
        return navigator.language || 'en-US';
    }

    async checkAllSystems() {
        const checkPromises = this.systems.map(system => this.checkSystem(system));
        await Promise.all(checkPromises);
    }

    async checkSystem(system) {
        // For private systems (behind Cloudflare Access), check if CF responds
        if (system.isPrivate && system.url) {
            try {
                const startTime = performance.now();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                // Try to fetch - Cloudflare Access will return 403 if protected but running
                const response = await fetch(system.url, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal,
                    cache: 'no-store'
                });

                clearTimeout(timeoutId);
                const responseTime = Math.round(performance.now() - startTime);

                // If we got here without error, the server responded (even if CF blocks with 403)
                this.statusData.set(system.name, {
                    status: 'protected',
                    responseTime: responseTime,
                    lastCheck: new Date(),
                    error: null
                });
            } catch (error) {
                // Network error = server is actually down
                this.statusData.set(system.name, {
                    status: 'offline',
                    responseTime: null,
                    lastCheck: new Date(),
                    error: 'Connection failed'
                });
            }
            return;
        }

        if (!system.url) {
            // System not publicly accessible - mark as unknown
            this.statusData.set(system.name, {
                status: 'unknown',
                responseTime: null,
                lastCheck: new Date(),
                error: null
            });
            return;
        }

        try {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(system.url, {
                method: 'HEAD',
                mode: 'no-cors', // Avoid CORS issues
                signal: controller.signal,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);
            const responseTime = Math.round(performance.now() - startTime);

            // With no-cors, we can't check status, but if no error, assume online
            this.statusData.set(system.name, {
                status: 'online',
                responseTime: responseTime,
                lastCheck: new Date(),
                error: null
            });
        } catch (error) {
            // Try alternative method: check if URL is reachable via image
            try {
                const img = new Image();
                const checkPromise = new Promise((resolve, reject) => {
                    img.onload = () => resolve('online');
                    img.onerror = () => reject(new Error('Failed to load'));
                    setTimeout(() => reject(new Error('Timeout')), 5000);
                });
                img.src = system.url + '/favicon.ico?' + Date.now();
                await checkPromise;

                this.statusData.set(system.name, {
                    status: 'online',
                    responseTime: null,
                    lastCheck: new Date(),
                    error: null
                });
            } catch (imgError) {
                this.statusData.set(system.name, {
                    status: 'offline',
                    responseTime: null,
                    lastCheck: new Date(),
                    error: error.message || 'Connection failed'
                });
            }
        }
    }

    renderStatus() {
        const gridEl = document.getElementById('status-grid');
        if (!gridEl) return;

        const categories = {
            thirdParty: this.t('status.category.thirdParty', 'Third-Party Services'),
            myProjects: this.t('status.category.myProjects', 'My Projects')
        };

        let html = '';

        // Group by category
        const grouped = {
            thirdParty: [],
            myProjects: []
        };

        this.systems.forEach(system => {
            grouped[system.category].push(system);
        });

        // Render each category
        Object.keys(grouped).forEach(category => {
            if (grouped[category].length === 0) return;

            html += `<div class="status__category">
                <h2 class="status__category-title">${categories[category]}</h2>
                <div class="status__items">`;

            grouped[category].forEach(system => {
                html += this.createStatusCard(system);
            });

            html += `</div></div>`;
        });

        gridEl.innerHTML = html;
    }

    createStatusCard(system) {
        const statusInfo = this.statusData.get(system.name) || {
            status: 'checking',
            responseTime: null,
            lastCheck: null,
            error: null
        };

        const statusClass = `status__card--${statusInfo.status}`;
        const statusText = this.getStatusText(statusInfo.status);
        const statusIcon = this.getStatusIcon(statusInfo.status);

        const responseTimeHtml = statusInfo.responseTime
            ? `<span class="status__response-time">${statusInfo.responseTime}ms</span>`
            : '';

        let urlHtml;
        if (system.isPrivate) {
            // Private system - show text but no clickable link
            urlHtml = `<span class="status__private-note">
                <i class='bx bx-lock-alt'></i>
                <span data-i18n="status.privateSystem">${this.t('status.privateSystem', 'Not intended for public access')}</span>
            </span>`;
        } else if (system.url) {
            // Public system with URL
            urlHtml = `<a href="${system.url}" target="_blank" rel="noopener noreferrer" class="status__link">
                <i class='bx bx-link-external'></i>
                <span>${this.escapeHtml(system.url.replace('https://', ''))}</span>
            </a>`;
        } else {
            // No URL at all
            urlHtml = `<span class="status__no-url" data-i18n="status.noPublicUrl">${this.t('status.noPublicUrl', 'Not publicly accessible')}</span>`;
        }

        const githubHtml = system.github
            ? `<a href="${system.github}" target="_blank" rel="noopener noreferrer" class="status__link">
                <i class='bx bx-code-alt'></i>
                <span data-i18n="status.viewGitHub">GitHub</span>
            </a>`
            : '';

        return `
            <div class="status__card ${statusClass}">
                <div class="status__card-header">
                    <div class="status__indicator status__indicator--${statusInfo.status}"></div>
                    <h3 class="status__card-title">${this.escapeHtml(system.name)}</h3>
                </div>
                <div class="status__card-body">
                    <div class="status__status-text">
                        <i class='bx ${statusIcon}'></i>
                        <span>${statusText}</span>
                        ${responseTimeHtml}
                    </div>
                    <div class="status__card-links">
                        ${urlHtml}
                        ${githubHtml}
                    </div>
                    ${statusInfo.error ? `<p class="status__error">${this.escapeHtml(statusInfo.error)}</p>` : ''}
                </div>
            </div>
        `;
    }

    getStatusText(status) {
        const texts = {
            online: this.t('status.legend.online', 'Online'),
            offline: this.t('status.legend.offline', 'Offline'),
            checking: this.t('status.legend.checking', 'Checking...'),
            unknown: this.t('status.legend.unknown', 'Unknown'),
            protected: this.t('status.legend.protected', 'Protected')
        };
        return texts[status] || texts.unknown;
    }

    getStatusIcon(status) {
        const icons = {
            online: 'bx-check-circle',
            offline: 'bx-x-circle',
            checking: 'bx-loader-alt bx-spin',
            unknown: 'bx-question-mark',
            protected: 'bx-shield-quarter'
        };
        return icons[status] || icons.unknown;
    }

    startAutoRefresh() {
        setInterval(() => {
            this.checkAllSystems().then(() => {
                this.renderStatus();
                this.updateLastUpdateTime();
            });
        }, this.checkInterval);
    }

    t(key, fallback = '') {
        if (window.i18n?.t) {
            const translation = window.i18n.t(key);
            if (translation && translation !== key) {
                return translation;
            }
        }
        return fallback || key;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
(function () {
    const init = () => {
        if (typeof window.systemStatus === 'undefined') {
            window.systemStatus = new SystemStatus();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
