/**
 * GitHub API Service - Centralized API management with persistent caching
 *
 * Features:
 * - Persistent localStorage caching with TTL
 * - Shared data between widgets
 * - Rate limit tracking and handling
 * - Batch request optimization
 * - Automatic cache invalidation
 */

class GitHubAPIService {
    constructor(username = 'FaserF', organizations = ['faneX-ID']) {
        this.username = username;
        this.organizations = organizations;
        this.cachePrefix = 'github_api_';
        this.cacheTTL = {
            repos: 30 * 60 * 1000,        // 30 minutes
            releases: 15 * 60 * 1000,     // 15 minutes
            commits: 10 * 60 * 1000,       // 10 minutes
            prs: 15 * 60 * 1000,           // 15 minutes
            user: 60 * 60 * 1000           // 1 hour
        };
        this.rateLimitInfo = {
            remaining: null,
            reset: null,
            limit: null
        };
        this.pendingRequests = new Map();
        this.init();
    }

    init() {
        this.loadRateLimitInfo();
    }

    /**
     * Main fetch method with persistent caching
     */
    async fetch(url, cacheKey, ttl = 15 * 60 * 1000, options = {}) {
        // Check in-memory cache first (for same session)
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        // Check localStorage cache
        const cached = this.getCached(cacheKey, ttl);
        if (cached !== null) {
            return cached;
        }

        // Create promise for this request (deduplicate concurrent requests)
        const fetchPromise = this._doFetch(url, cacheKey, ttl, options);
        this.pendingRequests.set(cacheKey, fetchPromise);

        try {
            const result = await fetchPromise;
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async _doFetch(url, cacheKey, ttl, options) {
        try {
            // Check rate limits before making request
            await this.checkRateLimit();

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    ...options.headers
                },
                ...options
            });

            // Update rate limit info
            this.updateRateLimitInfo(response);

            if (response.status === 403) {
                const resetTime = this.getRateLimitResetTime(response);
                throw new Error(`Rate limit exceeded. Retry after ${resetTime}`);
            }

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            this.setCached(cacheKey, data, ttl);

            return data;
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                // Cache rate limit error for a short time
                this.setCached(cacheKey, { error: error.message }, 5 * 60 * 1000);
            }
            throw error;
        }
    }

    /**
     * Get user repositories (shared across widgets)
     * Also includes repositories from specified organizations
     */
    async getUserRepositories(forceRefresh = false, organizations = ['faneX-ID']) {
        const cacheKey = `repos:${this.username}:${organizations.join(',')}`;

        if (forceRefresh) {
            this.clearCache(cacheKey);
        }

        // Check cache first
        const cached = this.getCached(cacheKey, this.cacheTTL.repos);
        if (cached !== null) {
            return cached;
        }

        // Fetch user repositories
        const userRepos = await this.fetch(
            `https://api.github.com/users/${this.username}/repos?sort=updated&per_page=100&type=all`,
            `repos:${this.username}`,
            this.cacheTTL.repos
        );

        let allRepos = Array.isArray(userRepos) ? userRepos : [];

        // Fetch organization repositories
        for (const org of organizations) {
            try {
                const orgRepos = await this.fetch(
                    `https://api.github.com/orgs/${org}/repos?sort=updated&per_page=100&type=all`,
                    `repos:org:${org}`,
                    this.cacheTTL.repos
                );

                if (Array.isArray(orgRepos)) {
                    // Mark organization repos
                    orgRepos.forEach(repo => {
                        repo.isOrgRepo = true;
                        repo.organization = org;
                    });
                    allRepos = allRepos.concat(orgRepos);
                }
            } catch (error) {
                console.warn(`Failed to load repositories for organization ${org}:`, error);
            }
        }

        // Sort by updated date
        allRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        // Cache combined result
        this.setCached(cacheKey, allRepos, this.cacheTTL.repos);

        return allRepos;
    }

    /**
     * Get repository releases (with caching)
     */
    async getRepositoryReleases(repoFullName, perPage = 5) {
        const cacheKey = `releases:${repoFullName}:${perPage}`;

        return await this.fetch(
            `https://api.github.com/repos/${repoFullName}/releases?per_page=${perPage}`,
            cacheKey,
            this.cacheTTL.releases
        );
    }

    /**
     * Get repository commits (with caching)
     */
    async getRepositoryCommits(repoFullName, since, perPage = 100) {
        const sinceParam = since ? `&since=${since.toISOString()}` : '';
        const cacheKey = `commits:${repoFullName}:${since ? since.toISOString().split('T')[0] : 'all'}:${perPage}`;

        return await this.fetch(
            `https://api.github.com/repos/${repoFullName}/commits?per_page=${perPage}${sinceParam}`,
            cacheKey,
            this.cacheTTL.commits
        );
    }

    /**
     * Search for pull requests (with caching)
     */
    async searchPullRequests(query, sort = 'created', order = 'desc', perPage = 30) {
        const cacheKey = `prs:${query}:${sort}:${order}:${perPage}`;

        return await this.fetch(
            `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&per_page=${perPage}`,
            cacheKey,
            this.cacheTTL.prs
        );
    }

    /**
     * Batch fetch releases for multiple repositories
     */
    async batchGetReleases(repoFullNames, perPage = 5) {
        // Limit concurrent requests to avoid rate limits
        const batchSize = 5;
        const results = new Map();

        for (let i = 0; i < repoFullNames.length; i += batchSize) {
            const batch = repoFullNames.slice(i, i + batchSize);
            const batchPromises = batch.map(async (repoFullName) => {
                try {
                    const releases = await this.getRepositoryReleases(repoFullName, perPage);
                    return { repoFullName, releases: Array.isArray(releases) ? releases : [] };
                } catch (error) {
                    console.warn(`Failed to load releases for ${repoFullName}:`, error);
                    return { repoFullName, releases: [] };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(({ repoFullName, releases }) => {
                results.set(repoFullName, releases);
            });

            // Small delay between batches to be gentle on API
            if (i + batchSize < repoFullNames.length) {
                await this.delay(100);
            }
        }

        return results;
    }

    /**
     * Batch fetch commits for multiple repositories
     */
    async batchGetCommits(repoFullNames, since, perPage = 100) {
        const batchSize = 5;
        const results = new Map();

        for (let i = 0; i < repoFullNames.length; i += batchSize) {
            const batch = repoFullNames.slice(i, i + batchSize);
            const batchPromises = batch.map(async (repoFullName) => {
                try {
                    const commits = await this.getRepositoryCommits(repoFullName, since, perPage);
                    return { repoFullName, commits: Array.isArray(commits) ? commits : [] };
                } catch (error) {
                    console.warn(`Failed to load commits for ${repoFullName}:`, error);
                    return { repoFullName, commits: [] };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(({ repoFullName, commits }) => {
                results.set(repoFullName, commits);
            });

            if (i + batchSize < repoFullNames.length) {
                await this.delay(100);
            }
        }

        return results;
    }

    /**
     * Cache management
     */
    getCached(key, ttl) {
        try {
            const cached = localStorage.getItem(this.cachePrefix + key);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age > ttl) {
                localStorage.removeItem(this.cachePrefix + key);
                return null;
            }

            // Check if cached data is an error
            if (data && data.error) {
                return null; // Don't return cached errors
            }

            return data;
        } catch (error) {
            console.warn('Error reading cache:', error);
            return null;
        }
    }

    setCached(key, data, ttl) {
        try {
            const cacheData = {
                data,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(cacheData));
        } catch (error) {
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, clearing old cache');
                this.clearOldCache();
                // Retry once
                try {
                    localStorage.setItem(this.cachePrefix + key, JSON.stringify({ data, timestamp: Date.now(), ttl }));
                } catch (retryError) {
                    console.error('Failed to cache after cleanup:', retryError);
                }
            } else {
                console.warn('Error writing cache:', error);
            }
        }
    }

    clearCache(key) {
        localStorage.removeItem(this.cachePrefix + key);
    }

    clearOldCache() {
        const now = Date.now();
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.cachePrefix)) {
                try {
                    const cached = JSON.parse(localStorage.getItem(key));
                    if (cached && (now - cached.timestamp > cached.ttl)) {
                        keysToRemove.push(key);
                    }
                } catch (error) {
                    // Invalid cache entry, remove it
                    keysToRemove.push(key);
                }
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Rate limit management
     */
    updateRateLimitInfo(response) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const reset = response.headers.get('x-ratelimit-reset');
        const limit = response.headers.get('x-ratelimit-limit');

        if (remaining !== null) {
            this.rateLimitInfo.remaining = parseInt(remaining, 10);
        }
        if (reset !== null) {
            this.rateLimitInfo.reset = parseInt(reset, 10) * 1000;
        }
        if (limit !== null) {
            this.rateLimitInfo.limit = parseInt(limit, 10);
        }

        this.saveRateLimitInfo();
    }

    loadRateLimitInfo() {
        try {
            const cached = localStorage.getItem(this.cachePrefix + 'ratelimit');
            if (cached) {
                const info = JSON.parse(cached);
                // Only use if reset time hasn't passed
                if (info.reset && Date.now() < info.reset) {
                    this.rateLimitInfo = info;
                }
            }
        } catch (error) {
            console.warn('Error loading rate limit info:', error);
        }
    }

    saveRateLimitInfo() {
        try {
            localStorage.setItem(this.cachePrefix + 'ratelimit', JSON.stringify(this.rateLimitInfo));
        } catch (error) {
            console.warn('Error saving rate limit info:', error);
        }
    }

    async checkRateLimit() {
        if (this.rateLimitInfo.remaining !== null && this.rateLimitInfo.remaining <= 5) {
            const resetTime = this.rateLimitInfo.reset;
            if (resetTime && Date.now() < resetTime) {
                const waitTime = resetTime - Date.now();
                if (waitTime > 0) {
                    const timeStr = new Date(resetTime).toLocaleTimeString();
                    const remaining = this.rateLimitInfo.remaining;
                    // Try to get i18n translation
                    let message = `Rate limit low (${remaining} remaining). Retry after ${timeStr}`;
                    if (window.i18n && window.i18n.t) {
                        const template = window.i18n.t('github.activity.rateLimitLow', 'Rate limit low ({{remaining}} remaining). Retry after {{time}}.');
                        message = template.replace('{{remaining}}', remaining).replace('{{time}}', timeStr);
                    }
                    throw new Error(message);
                }
            }
        }
    }

    getRateLimitResetTime(response) {
        const reset = response.headers.get('x-ratelimit-reset');
        if (!reset) return 'soon';
        const resetDate = new Date(parseInt(reset) * 1000);
        return resetDate.toLocaleTimeString();
    }

    /**
     * Utility methods
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear all GitHub API cache
     */
    clearAllCache() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.cachePrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}

// Create singleton instance
if (typeof window.githubAPIService === 'undefined') {
    window.githubAPIService = new GitHubAPIService('FaserF');
}
