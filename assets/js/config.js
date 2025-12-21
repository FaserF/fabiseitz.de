/**
 * Global Configuration for Environment Handling
 * Determines if the current environment is Beta/Local or Production
 */
const CONFIG = (() => {
    const hostname = window.location.hostname;
    // Treat Localhost, 127.0.0.1, and beta subdomains as 'Beta' environment
    // Also treat file protocol as Local/Beta
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const isBetaDomain = hostname.startsWith('beta.');

    // We default to Beta mode for local dev to test beta endpoints.
    // If you want to test against Production URLs locally, set this to false manually or via localStorage.
    const isBeta = isBetaDomain || isLocal;

    const getApiUrl = (subdomain, path = '/') => {
        // Construct URL: https://[beta.]subdomain.fabiseitz.de[/path]
        const prefix = isBeta ? 'beta.' : '';
        // Clean path to ensure it starts with /
        const safePath = path.startsWith('/') ? path : `/${path}`;
        return `https://${prefix}${subdomain}.fabiseitz.de${safePath}`;
    };

    return {
        isBeta,
        isLocal,
        getApiUrl,
        endpoints: {
            // Mapping for specific services
            contactForm: getApiUrl('contacttomail'), // -> https://[beta.]contacttomail.fabiseitz.de/
            calendarProxy: getApiUrl('api', '?url=') // -> https://[beta.]api.fabiseitz.de/?url=
        }
    };
})();

// Expose to window for easy access
window.SITE_CONFIG = CONFIG;
console.log(`Environment: ${CONFIG.isBeta ? 'BETA/LOCAL' : 'PRODUCTION'}`);
