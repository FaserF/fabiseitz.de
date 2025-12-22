/**
 * i18n System for fabiseitz.de
 * Supports German (de) and English (en)
 */

// Prevent multiple class declarations
if (typeof window.I18n === 'undefined') {
    window.I18n = class I18n {
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
                this.updateFooterTitle();

                // Dispatch initialization event
                window.dispatchEvent(new CustomEvent('i18nInitialized', {
                    detail: { language: this.currentLang }
                }));

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
                // Check if we're on file:// protocol (local file)
                if (window.location.protocol === 'file:') {
                    console.warn('Running on file:// protocol. Translations may not load due to CORS. Please use a local server (e.g., python -m http.server).');
                    // Use empty translations for file:// to prevent errors
                    this.translations = {};
                    this.currentLang = lang;
                    try {
                        localStorage.setItem('preferred-language', lang);
                    } catch (e) {
                        // localStorage might not be available
                    }
                    return;
                }

                const response = await fetch(`assets/i18n/${lang}.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${lang}.json: ${response.status} ${response.statusText}`);
                }
                const text = await response.text();
                // Trim whitespace and check if empty
                const trimmedText = text.trim();
                if (!trimmedText) {
                    throw new Error(`Empty response for ${lang}.json`);
                }

                let data;
                try {
                    data = JSON.parse(trimmedText);
                } catch (parseError) {
                    console.error(`Failed to parse ${lang}.json:`, parseError);
                    console.error(`JSON content (first 500 chars):`, trimmedText.substring(0, 500));
                    throw new Error(`Invalid JSON in ${lang}.json: ${parseError.message}`);
                }
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

            // Only return key if value is null or undefined, allow falsy values like "" or 0
            return value !== undefined && value !== null ? value : key;
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
            const metaRaw = this.t('meta');
            // Guard against non-object meta values
            const meta = (typeof metaRaw === 'object' && metaRaw !== null) ? metaRaw : {};

            // Update title only if it exists
            if (meta.title) {
                document.title = meta.title;
            }

            // Update meta description only if it exists
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && meta.description) {
                metaDesc.setAttribute('content', meta.description);
            }

            // Update meta keywords only if it exists
            const metaKeywords = document.querySelector('meta[name="keywords"]');
            if (metaKeywords && meta.keywords) {
                metaKeywords.setAttribute('content', meta.keywords);
            }

            // Update Open Graph only if it exists
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && meta.title) {
                ogTitle.setAttribute('content', meta.title);
            }

            const ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc && meta.description) {
                ogDesc.setAttribute('content', meta.description);
            }

            // Update Twitter Card only if it exists
            const twitterTitle = document.querySelector('meta[name="twitter:title"]');
            if (twitterTitle && meta.title) {
                twitterTitle.setAttribute('content', meta.title);
            }

            const twitterDesc = document.querySelector('meta[name="twitter:description"]');
            if (twitterDesc && meta.description) {
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

            console.log('Changing language to:', lang);

            try {
                await this.loadTranslations(lang);
                this.applyTranslations();
                this.updateMetaTags();
                this.updateHtmlLang();
                this.updateFooterTitle();

                // Update language switcher
                this.updateLanguageSwitcher();

                // Trigger custom event for other scripts
                window.dispatchEvent(new CustomEvent('languageChanged', {
                    detail: { language: lang }
                }));

                console.log('Language changed successfully to:', lang);
            } catch (error) {
                console.error('Error changing language:', error);
                throw error;
            }
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
                console.log('Found language switcher buttons:', buttons.length);

                // Store reference to this for use in event handlers
                const self = this;

                buttons.forEach(btn => {
                    // Remove any existing listeners by cloning the button
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);

                    newBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const lang = this.getAttribute('data-lang');
                        console.log('Language switch clicked:', lang, 'Current language:', self.currentLang);

                        if (lang && (lang === 'de' || lang === 'en')) {
                            // Only change if it's different from current language
                            if (lang !== self.currentLang) {
                                self.changeLanguage(lang).catch(err => {
                                    console.error('Error changing language:', err);
                                });
                            } else {
                                console.log('Language already set to:', lang);
                            }
                        } else {
                            console.error('Invalid language code:', lang);
                        }
                    });
                });
                this.updateLanguageSwitcher();
            } else {
                console.warn('Language switcher element not found');
                // Retry after a short delay in case DOM isn't ready yet
                setTimeout(() => {
                    const retrySwitcher = document.getElementById('language-switcher');
                    if (retrySwitcher) {
                        console.log('Retrying language switcher initialization...');
                        this.initLanguageSwitcher();
                    }
                }, 500);
            }
        }

        /**
         * Get current language
         */
        getCurrentLanguage() {
            return this.currentLang;
        }

        /**
         * Update footer title with current job title from CV
         */
        updateFooterTitle() {
            // Get current job title from CV translations
            const currentJobTitle = this.t('cv.experience.current.title');

            if (currentJobTitle && currentJobTitle !== 'cv.experience.current.title') {
                // Find all footer subtitle elements
                const footerSubtitles = document.querySelectorAll('.footer__subtitle');
                footerSubtitles.forEach(element => {
                    // Only update if it has the data-i18n attribute for footer.subtitle
                    if (element.getAttribute('data-i18n') === 'footer.subtitle') {
                        element.textContent = currentJobTitle;
                    }
                });
            }
        }
    }

    // Initialize i18n when DOM is ready
    // Prevent multiple initializations
    if (typeof window.i18n === 'undefined') {
        let i18n;
        function initI18n() {
            if (!i18n && typeof window.I18n !== 'undefined') {
                i18n = new window.I18n();
                window.i18n = i18n; // Make it globally available
                console.log('i18n instance created and stored globally');
            } else if (i18n) {
                console.log('i18n already initialized');
            } else {
                console.error('I18n class not available');
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initI18n);
        } else {
            // DOM already loaded
            initI18n();
        }

        // Also try to initialize after a short delay to ensure DOM is fully ready
        setTimeout(() => {
            if (!window.i18n && typeof window.I18n !== 'undefined') {
                initI18n();
            }
        }, 100);
    }
}
