/**
 * i18n System for fabiseitz.de
 * Supports German (de) and English (en)
 */

class I18n {
    constructor() {
        this.currentLang = this.detectLanguage();
        this.translations = {};
        this.init();
    }

    /**
     * Detect user's preferred language
     */
    detectLanguage() {
        // Check localStorage first
        const stored = localStorage.getItem('preferred-language');
        if (stored && (stored === 'de' || stored === 'en')) {
            return stored;
        }

        // Check browser language
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith('de')) {
            return 'de';
        }
        return 'en'; // Default to English
    }

    /**
     * Initialize i18n system
     */
    async init() {
        try {
            console.log('Initializing i18n with language:', this.currentLang);
            await this.loadTranslations(this.currentLang);
            console.log('Translations loaded:', Object.keys(this.translations).length, 'top-level keys');
            this.applyTranslations();
            this.updateMetaTags();
            this.updateHtmlLang();
            this.initLanguageSwitcher();
            console.log('i18n initialization complete');
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
            // Try to apply translations anyway if they were loaded
            if (Object.keys(this.translations).length > 0) {
                this.applyTranslations();
            }
        }
    }

    /**
     * Load translation file
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`assets/i18n/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            if (!data || typeof data !== 'object') {
                throw new Error(`Invalid JSON structure in ${lang}.json`);
            }
            this.translations = data;
            this.currentLang = lang;
            localStorage.setItem('preferred-language', lang);
        } catch (error) {
            console.error(`Error loading translations for ${lang}:`, error);
            // Fallback to English if German fails
            if (lang === 'de') {
                console.log('Falling back to English...');
                await this.loadTranslations('en');
            } else {
                // If English also fails, use empty object to prevent errors
                this.translations = {};
                console.error('Failed to load any translations');
            }
        }
    }

    /**
     * Get translation by key path (e.g., 'nav.home')
     */
    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }

        return value || key;
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        // Handle text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.type === 'submit' || element.type === 'button') {
                    element.value = translation;
                } else if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    element.value = translation;
                }
            } else if (element.hasAttribute('data-i18n-html')) {
                element.innerHTML = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Handle placeholder attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            element.placeholder = translation;
        });

        // Handle attributes
        document.querySelectorAll('[data-i18n-attr]').forEach(element => {
            const attrData = element.getAttribute('data-i18n-attr');
            const [attr, key] = attrData.split(':');
            const translation = this.t(key);
            element.setAttribute(attr, translation);
        });

        // Handle title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
    }

    /**
     * Update meta tags
     */
    updateMetaTags() {
        const meta = this.t('meta');

        // Update title
        document.title = meta.title;

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', meta.description);
        }

        // Update meta keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            metaKeywords.setAttribute('content', meta.keywords);
        }

        // Update Open Graph
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.setAttribute('content', meta.title);
        }

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) {
            ogDesc.setAttribute('content', meta.description);
        }

        // Update Twitter Card
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            twitterTitle.setAttribute('content', meta.title);
        }

        const twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) {
            twitterDesc.setAttribute('content', meta.description);
        }
    }

    /**
     * Update HTML lang attribute
     */
    updateHtmlLang() {
        document.documentElement.setAttribute('lang', this.currentLang);
    }

    /**
     * Change language
     */
    async changeLanguage(lang) {
        if (lang !== 'de' && lang !== 'en') {
            console.error('Invalid language:', lang);
            return;
        }

        await this.loadTranslations(lang);
        this.applyTranslations();
        this.updateMetaTags();
        this.updateHtmlLang();

        // Update language switcher
        this.updateLanguageSwitcher();

        // Trigger custom event for other scripts
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: lang }
        }));
    }

    /**
     * Update language switcher UI
     */
    updateLanguageSwitcher() {
        const switcher = document.getElementById('language-switcher');
        if (switcher) {
            const buttons = switcher.querySelectorAll('button');
            buttons.forEach(btn => {
                const lang = btn.getAttribute('data-lang');
                if (lang === this.currentLang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    /**
     * Initialize language switcher event listeners
     */
    initLanguageSwitcher() {
        const switcher = document.getElementById('language-switcher');
        if (switcher) {
            const buttons = switcher.querySelectorAll('button[data-lang]');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const lang = btn.getAttribute('data-lang');
                    this.changeLanguage(lang);
                });
            });
            this.updateLanguageSwitcher();
        }
    }

    /**
     * Get current language
     */
    getCurrentLanguage() {
        return this.currentLang;
    }
}

// Initialize i18n when DOM is ready
let i18n;
function initI18n() {
    if (!i18n) {
        i18n = new I18n();
        window.i18n = i18n; // Make it globally available
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    // DOM already loaded
    initI18n();
}
