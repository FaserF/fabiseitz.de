# Tests

This directory contains test suites for the fabiseitz.de website.

## Test Suites

### i18n-test.js

Tests for internationalization (i18n) completeness and consistency:

- ✅ Validates JSON structure of all translation files
- ✅ Checks that all languages have the same keys
- ✅ Verifies that all HTML i18n keys exist in translation files
- ✅ Detects empty translations
- ✅ Warns about unused translation keys

**Run:** `npm run test:i18n` or `npm test`

### lint-test.js

Basic linting checks:

- ✅ Validates JSON syntax of translation files
- ✅ Checks HTML for common issues
- ✅ Validates i18n attribute usage

**Run:** `npm run lint`

## Running Tests

```bash
# Run all tests
npm test

# Run i18n tests only
npm run test:i18n

# Run lint tests only
npm run lint
```

## CI Integration

Tests are automatically run in GitHub Actions on:
- Push to `main` or `master` branch
- Pull requests to `main` or `master` branch

See `.github/workflows/ci.yml` for details.
