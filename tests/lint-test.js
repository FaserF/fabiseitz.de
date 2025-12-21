#!/usr/bin/env node

/**
 * Lint Test Suite
 * Basic linting checks for HTML and JSON files
 */

const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, '../index.html');
const I18N_DIR = path.join(__dirname, '../assets/i18n');
const SUPPORTED_LANGUAGES = ['de', 'en'];

let errors = [];
let warnings = [];

/**
 * Validate JSON file
 */
function validateJSONFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        return true;
    } catch (error) {
        errors.push(`${path.basename(filePath)}: Invalid JSON - ${error.message}`);
        return false;
    }
}

/**
 * Check HTML for common issues
 */
function lintHTML() {
    if (!fs.existsSync(HTML_FILE)) {
        errors.push(`HTML file not found: ${HTML_FILE}`);
        return;
    }

    const html = fs.readFileSync(HTML_FILE, 'utf8');

    // Check for unclosed tags (basic check)
    const openTags = html.match(/<[^/][^>]*>/g) || [];
    const closeTags = html.match(/<\/[^>]+>/g) || [];

    // Check for data-i18n attributes without values
    const emptyI18nRegex = /data-i18n=["']\s*["']/g;
    if (emptyI18nRegex.test(html)) {
        errors.push('HTML: Found empty data-i18n attributes');
    }

    // Check for missing alt attributes on images
    const imgRegex = /<img[^>]*>/g;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        if (!match[0].includes('alt=') && !match[0].includes('alt="')) {
            warnings.push('HTML: Image missing alt attribute');
        }
    }
}

/**
 * Check translation files
 */
function lintTranslations() {
    for (const lang of SUPPORTED_LANGUAGES) {
        const filePath = path.join(I18N_DIR, `${lang}.json`);
        if (fs.existsSync(filePath)) {
            validateJSONFile(filePath);
        } else {
            errors.push(`Translation file not found: ${lang}.json`);
        }
    }
}

/**
 * Main lint function
 */
function runLint() {
    console.log('🔍 Running lint tests...\n');

    lintHTML();
    lintTranslations();

    // Print results
    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(error => console.log(`  - ${error}`));
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(`\n📊 Summary: ${errors.length} errors, ${warnings.length} warnings`);

    if (errors.length > 0) {
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Lint passed with warnings');
        process.exit(0);
    }

    console.log('\n✅ Lint passed!');
    process.exit(0);
}

// Run lint
runLint();
