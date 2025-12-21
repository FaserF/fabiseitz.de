#!/usr/bin/env node

/**
 * i18n Test Suite
 * Tests for translation completeness and consistency
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../assets/i18n');
const HTML_FILE = path.join(__dirname, '../index.html');
const SUPPORTED_LANGUAGES = ['de', 'en'];

let errors = [];
let warnings = [];

/**
 * Recursively get all keys from an object
 */
function getAllKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getAllKeys(obj[key], prefix ? `${prefix}.${key}` : key));
        } else {
            keys.push(prefix ? `${prefix}.${key}` : key);
        }
    }
    return keys;
}

/**
 * Get value by key path
 */
function getValueByPath(obj, path) {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * Load and parse JSON file
 */
function loadTranslationFile(lang) {
    const filePath = path.join(I18N_DIR, `${lang}.json`);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        errors.push(`Failed to load ${lang}.json: ${error.message}`);
        return null;
    }
}

/**
 * Validate JSON structure
 */
function validateJSON(lang, data) {
    if (!data || typeof data !== 'object') {
        errors.push(`${lang}.json: Invalid JSON structure`);
        return false;
    }
    return true;
}

/**
 * Check if all languages have the same keys
 */
function checkKeyConsistency() {
    const translations = {};
    const allKeys = new Set();

    // Load all translation files
    for (const lang of SUPPORTED_LANGUAGES) {
        const data = loadTranslationFile(lang);
        if (data) {
            translations[lang] = data;
            const keys = getAllKeys(data);
            keys.forEach(key => allKeys.add(key));
        }
    }

    // Check if all languages have all keys
    for (const lang of SUPPORTED_LANGUAGES) {
        if (!translations[lang]) continue;

        const langKeys = new Set(getAllKeys(translations[lang]));

        for (const key of allKeys) {
            if (!langKeys.has(key)) {
                errors.push(`${lang}.json: Missing key "${key}"`);
            }
        }
    }

    return translations;
}

/**
 * Check if translation values are not empty
 */
function checkEmptyTranslations(translations) {
    for (const lang of SUPPORTED_LANGUAGES) {
        if (!translations[lang]) continue;

        const keys = getAllKeys(translations[lang]);
        for (const key of keys) {
            const value = getValueByPath(translations[lang], key);
            if (value === '' || value === null || value === undefined) {
                warnings.push(`${lang}.json: Empty translation for key "${key}"`);
            }
        }
    }
}

/**
 * Extract i18n keys from HTML
 */
function extractI18nKeysFromHTML() {
    try {
        const html = fs.readFileSync(HTML_FILE, 'utf8');
        const keys = new Set();

        // Match data-i18n attributes
        const i18nRegex = /data-i18n=["']([^"']+)["']/g;
        let match;
        while ((match = i18nRegex.exec(html)) !== null) {
            keys.add(match[1]);
        }

        // Match data-i18n-placeholder attributes
        const placeholderRegex = /data-i18n-placeholder=["']([^"']+)["']/g;
        while ((match = placeholderRegex.exec(html)) !== null) {
            keys.add(match[1]);
        }

        // Match data-i18n-html attributes
        const htmlRegex = /data-i18n-html=["']([^"']+)["']/g;
        while ((match = htmlRegex.exec(html)) !== null) {
            keys.add(match[1]);
        }

        // Match data-i18n-attr attributes
        const attrRegex = /data-i18n-attr=["']([^"']+):([^"']+)["']/g;
        while ((match = attrRegex.exec(html)) !== null) {
            keys.add(match[2]);
        }

        // Match data-i18n-title attributes
        const titleRegex = /data-i18n-title=["']([^"']+)["']/g;
        while ((match = titleRegex.exec(html)) !== null) {
            keys.add(match[1]);
        }

        return Array.from(keys);
    } catch (error) {
        errors.push(`Failed to read HTML file: ${error.message}`);
        return [];
    }
}

/**
 * Check if all HTML i18n keys exist in translation files
 */
function checkHTMLKeysInTranslations(htmlKeys, translations) {
    for (const lang of SUPPORTED_LANGUAGES) {
        if (!translations[lang]) continue;

        for (const key of htmlKeys) {
            const value = getValueByPath(translations[lang], key);
            if (value === undefined) {
                errors.push(`HTML uses key "${key}" but it's missing in ${lang}.json`);
            }
        }
    }
}

/**
 * Check for unused translation keys
 */
function checkUnusedKeys(htmlKeys, translations) {
    for (const lang of SUPPORTED_LANGUAGES) {
        if (!translations[lang]) continue;

        const translationKeys = getAllKeys(translations[lang]);
        for (const key of translationKeys) {
            if (!htmlKeys.includes(key) && !key.startsWith('meta.')) {
                warnings.push(`${lang}.json: Key "${key}" is defined but not used in HTML`);
            }
        }
    }
}

/**
 * Main test function
 */
function runTests() {
    console.log('🌍 Running i18n tests...\n');

    // Check if i18n directory exists
    if (!fs.existsSync(I18N_DIR)) {
        errors.push(`i18n directory not found: ${I18N_DIR}`);
        printResults();
        process.exit(1);
    }

    // Check if HTML file exists
    if (!fs.existsSync(HTML_FILE)) {
        errors.push(`HTML file not found: ${HTML_FILE}`);
        printResults();
        process.exit(1);
    }

    // Load and validate translation files
    const translations = {};
    for (const lang of SUPPORTED_LANGUAGES) {
        const data = loadTranslationFile(lang);
        if (data && validateJSON(lang, data)) {
            translations[lang] = data;
        }
    }

    // Check key consistency
    const consistentTranslations = checkKeyConsistency();

    // Check for empty translations
    checkEmptyTranslations(consistentTranslations);

    // Extract keys from HTML
    const htmlKeys = extractI18nKeysFromHTML();
    console.log(`Found ${htmlKeys.length} i18n keys in HTML\n`);

    // Check if HTML keys exist in translations
    checkHTMLKeysInTranslations(htmlKeys, consistentTranslations);

    // Check for unused keys
    checkUnusedKeys(htmlKeys, consistentTranslations);

    // Print results
    printResults();

    // Exit with error code if there are errors
    if (errors.length > 0) {
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Tests passed with warnings');
        process.exit(0);
    }

    console.log('\n✅ All tests passed!');
    process.exit(0);
}

/**
 * Print test results
 */
function printResults() {
    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(error => console.log(`  - ${error}`));
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(`\n📊 Summary: ${errors.length} errors, ${warnings.length} warnings`);
}

// Run tests
runTests();
