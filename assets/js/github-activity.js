/**
 * GitHub Activity Widget - Enhanced
 * Displays comprehensive GitHub activity: releases, PRs, active projects, contributions
 *
 * Features:
 * - Recent releases from own repositories
 * - Pull requests to external repositories
 * - Active projects with high commit activity
 * - Filterable activity types
 * - Rate limiting handling
 * - i18n support
 */

class GitHubActivity {
    constructor(username = 'FaserF', config = {}) {
        this.username = username;
        this.config = {
            maxReleases: 5,
            maxPRs: 5,
            maxActiveProjects: 3,
            commitThreshold: 5,
            releaseDays: 30,
            activityDays: 7,
            ...config
        };
        this.state = {
            releases: [],
            pullRequests: [],
            activeProjects: [],
            loading: false,
            error: null
        };
        this.apiService = window.githubAPIService || new GitHubAPIService(username);
        this.init();
    }

    async init() {
        const containerEl = document.getElementById('github-activity');
        if (!containerEl) {
            console.warn('GitHub Activity container not found');
            return;
        }
        await this.loadActivity();
    }

    async loadActivity() {
        const containerEl = document.getElementById('github-activity');
        if (!containerEl) return;

        this.setState({ loading: true, error: null });
        this.renderLoading(containerEl);

        try {
            await Promise.all([
                this.loadRecentReleases(),
                this.loadExternalPullRequests(),
                this.loadActiveProjects()
            ]);

            this.setState({ loading: false });
            this.renderActivity(containerEl);
        } catch (error) {
            console.error('Error loading GitHub activity:', error);
            this.setState({ loading: false, error });
            this.renderError(containerEl, error);
        }
    }

    setState(updates) {
        this.state = { ...this.state, ...updates };
    }

    async loadRecentReleases() {
        const cutoffDate = this.getDateDaysAgo(this.config.releaseDays);
        const repos = await this.getUserRepositories();

        if (!repos || repos.length === 0) {
            this.state.releases = [];
            return;
        }

        // Use batch API call for better efficiency
        const repoFullNames = repos
            .filter(repo => !repo.fork)
            .slice(0, 20)
            .map(repo => repo.full_name);

        const releasesMap = await this.apiService.batchGetReleases(repoFullNames, 5);

        const allReleases = [];
        repos
            .filter(repo => !repo.fork && repoFullNames.includes(repo.full_name))
            .forEach(repo => {
                const releases = releasesMap.get(repo.full_name) || [];
                releases
                    .filter(release => release.published_at && new Date(release.published_at) >= cutoffDate)
                    .forEach(release => {
                        allReleases.push({
                            ...release,
                            repo: repo.name,
                            repoUrl: repo.html_url,
                            repoDescription: repo.description,
                            repoFullName: repo.full_name
                        });
                    });
            });

        this.state.releases = allReleases
            .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
            .slice(0, this.config.maxReleases);
    }

    async loadExternalPullRequests() {
        const cutoffDate = this.getDateDaysAgo(this.config.releaseDays);

        // Search for PRs created by user in external repositories
        const query = `author:${this.username} type:pr created:>=${this.formatDateForAPI(cutoffDate)}`;

        try {
            const searchResults = await this.apiService.searchPullRequests(query, 'created', 'desc', 30);

            if (!searchResults || !searchResults.items) {
                this.state.pullRequests = [];
                return;
            }

            // Filter out PRs from own repositories
            const ownRepos = new Set((await this.getUserRepositories()).map(r => r.full_name.toLowerCase()));

            this.state.pullRequests = searchResults.items
                .filter(pr => {
                    const repoFullName = pr.repository_url.replace('https://api.github.com/repos/', '').toLowerCase();
                    return !ownRepos.has(repoFullName);
                })
                .slice(0, this.config.maxPRs)
                .map(pr => ({
                    id: pr.id,
                    number: pr.number,
                    title: pr.title,
                    body: pr.body,
                    state: pr.state,
                    url: pr.html_url,
                    createdAt: pr.created_at,
                    updatedAt: pr.updated_at,
                    repoName: pr.repository_url.replace('https://api.github.com/repos/', '').split('/')[1],
                    repoOwner: pr.repository_url.replace('https://api.github.com/repos/', '').split('/')[0],
                    repoUrl: pr.html_url.split('/pull')[0],
                    repoFullName: pr.repository_url.replace('https://api.github.com/repos/', '')
                }));
        } catch (error) {
            console.warn('Failed to load external PRs:', error);
            this.state.pullRequests = [];
        }
    }

    async loadActiveProjects() {
        const cutoffDate = this.getDateDaysAgo(this.config.activityDays);
        const repos = await this.getUserRepositories();

        if (!repos || repos.length === 0) {
            this.state.activeProjects = [];
            return;
        }

        // Use batch API calls for better efficiency
        const repoFullNames = repos
            .filter(repo => !repo.fork)
            .slice(0, 20)
            .map(repo => repo.full_name);

        const [commitsMap, releasesMap] = await Promise.all([
            this.apiService.batchGetCommits(repoFullNames, cutoffDate, 100),
            this.apiService.batchGetReleases(repoFullNames, 1)
        ]);

        const activities = repos
            .filter(repo => !repo.fork && repoFullNames.includes(repo.full_name))
            .map(repo => {
                const commits = commitsMap.get(repo.full_name) || [];
                const releases = releasesMap.get(repo.full_name) || [];

                const commitCount = Array.isArray(commits) ? commits.length : 0;
                if (commitCount < this.config.commitThreshold) return null;

                return {
                    repo: repo.name,
                    repoUrl: repo.html_url,
                    repoDescription: repo.description,
                    commitCount,
                    lastCommit: commits[0]?.commit?.author?.date || repo.updated_at,
                    hasReleases: Array.isArray(releases) && releases.length > 0,
                    language: repo.language,
                    stars: repo.stargazers_count || 0,
                    forks: repo.forks_count || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.hasReleases !== b.hasReleases) {
                    return a.hasReleases ? 1 : -1;
                }
                return b.commitCount - a.commitCount;
            });

        this.state.activeProjects = activities.slice(0, this.config.maxActiveProjects);
    }

    async getUserRepositories() {
        try {
            return await this.apiService.getUserRepositories();
        } catch (error) {
            console.warn('Failed to load user repositories:', error);
            return [];
        }
    }

    getDateDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }

    formatDateForAPI(date) {
        return date.toISOString().split('T')[0];
    }

    renderLoading(containerEl) {
        containerEl.innerHTML = `
            <div class="github-activity__loading">
                <i class='bx bx-loader-alt bx-spin'></i>
                <p data-i18n="github.activity.loading">${this.t('github.activity.loading', 'Loading activities...')}</p>
            </div>
        `;
        this.applyI18n();
    }

    renderError(containerEl, error) {
        const message = error?.message || this.t('github.activity.error', 'Error loading activities.');
        containerEl.innerHTML = `
            <div class="github-activity__error">
                <i class='bx bx-error-circle'></i>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
    }

    renderActivity(containerEl) {
        const { releases, pullRequests, activeProjects } = this.state;
        const hasContent = releases.length > 0 || pullRequests.length > 0 || activeProjects.length > 0;

        if (!hasContent) {
            containerEl.innerHTML = `
                <div class="github-activity__empty">
                    <i class='bx bx-info-circle'></i>
                    <p data-i18n="github.activity.empty">${this.t('github.activity.empty', 'No current activities')}</p>
                </div>
            `;
            this.applyI18n();
            return;
        }

        const sections = [];

        if (releases.length > 0) {
            sections.push(this.createSection('releases', releases));
        }

        if (pullRequests.length > 0) {
            sections.push(this.createSection('pullRequests', pullRequests));
        }

        if (activeProjects.length > 0) {
            sections.push(this.createSection('activeProjects', activeProjects));
        }

        containerEl.innerHTML = `
            <div class="github-activity__content">
                ${sections.join('')}
            </div>
        `;

        this.applyI18n();
    }

    createSection(type, items) {
        const config = {
            releases: {
                title: 'github.activity.recentReleases',
                titleFallback: 'Recent Releases',
                icon: 'bx-gift',
                description: null
            },
            pullRequests: {
                title: 'github.activity.externalPRs',
                titleFallback: 'External Contributions',
                icon: 'bx-git-pull-request',
                description: 'github.activity.externalPRsDescription'
            },
            activeProjects: {
                title: 'github.activity.activeProjects',
                titleFallback: 'Active Projects',
                icon: 'bx-code-alt',
                description: 'github.activity.activeDescription'
            }
        };

        const sectionConfig = config[type];
        const cards = items.map(item => {
            switch (type) {
                case 'releases': return this.createReleaseCard(item);
                case 'pullRequests': return this.createPRCard(item);
                case 'activeProjects': return this.createActiveProjectCard(item);
                default: return '';
            }
        }).join('');

        return `
            <div class="github-activity__section" data-section="${type}">
                <h3 class="github-activity__section-title">
                    <i class='bx ${sectionConfig.icon}'></i>
                    <span data-i18n="${sectionConfig.title}">${this.t(sectionConfig.title, sectionConfig.titleFallback)}</span>
                </h3>
                ${sectionConfig.description ? `
                    <p class="github-activity__section-description" data-i18n="${sectionConfig.description}">
                        ${this.t(sectionConfig.description, sectionConfig.description === 'github.activity.externalPRsDescription' ? 'Pull requests to other developers\' projects - open source contributions.' : 'Projects with many commits - possibly a new release soon!')}
                    </p>
                ` : ''}
                <div class="github-activity__items">
                    ${cards}
                </div>
            </div>
        `;
    }

    createReleaseCard(release) {
        const locale = this.getLocale();
        const date = new Date(release.published_at).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const isPrerelease = release.prerelease;
        const releaseType = isPrerelease
            ? this.t('github.activity.prerelease', 'Pre-Release')
            : this.t('github.activity.release', 'Release');

        const description = release.body
            ? this.escapeHtml(release.body.substring(0, 150) + (release.body.length > 150 ? '...' : ''))
            : this.escapeHtml(release.repoDescription || '');

        return `
            <div class="github-activity-card github-activity-card--release ${isPrerelease ? 'github-activity-card--prerelease' : ''}">
                <div class="github-activity-card__header">
                    <a href="${release.html_url}" target="_blank" rel="noopener noreferrer" class="github-activity-card__title">
                        <i class='bx bx-gift'></i>
                        ${this.escapeHtml(release.repo)} ${this.escapeHtml(release.tag_name)}
                    </a>
                    <span class="github-activity-card__badge ${isPrerelease ? 'github-activity-card__badge--prerelease' : ''}">
                        ${releaseType}
                    </span>
                </div>
                <p class="github-activity-card__description">${description}</p>
                <div class="github-activity-card__meta">
                    <span class="github-activity-card__date">
                        <i class='bx bx-calendar'></i>
                        ${date}
                    </span>
                    <a href="${release.repoUrl}" target="_blank" rel="noopener noreferrer" class="github-activity-card__link">
                        <i class='bx bx-link-external'></i>
                        ${this.t('github.activity.viewRepo', 'Repository')}
                    </a>
                </div>
            </div>
        `;
    }

    createPRCard(pr) {
        const locale = this.getLocale();
        const date = new Date(pr.createdAt).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const description = pr.body
            ? this.escapeHtml(pr.body.substring(0, 120) + (pr.body.length > 120 ? '...' : ''))
            : '';

        return `
            <div class="github-activity-card github-activity-card--pr">
                <div class="github-activity-card__header">
                    <a href="${pr.url}" target="_blank" rel="noopener noreferrer" class="github-activity-card__title">
                        <i class='bx bx-git-pull-request'></i>
                        ${this.escapeHtml(pr.repoOwner)}/${this.escapeHtml(pr.repoName)} #${pr.number}
                    </a>
                    <span class="github-activity-card__badge github-activity-card__badge--${pr.state}">
                        ${pr.state === 'open' ? this.t('github.activity.prOpen', 'Open') : this.t('github.activity.prClosed', 'Closed')}
                    </span>
                </div>
                <p class="github-activity-card__title-secondary">${this.escapeHtml(pr.title)}</p>
                ${description ? `<p class="github-activity-card__description">${description}</p>` : ''}
                <div class="github-activity-card__meta">
                    <span class="github-activity-card__date">
                        <i class='bx bx-calendar'></i>
                        ${date}
                    </span>
                    <a href="${pr.repoUrl}" target="_blank" rel="noopener noreferrer" class="github-activity-card__link">
                        <i class='bx bx-link-external'></i>
                        ${this.t('github.activity.viewRepo', 'Repository')}
                    </a>
                </div>
            </div>
        `;
    }

    createActiveProjectCard(project) {
        const locale = this.getLocale();
        const date = new Date(project.lastCommit).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const potentialRelease = !project.hasReleases
            ? `<span class="github-activity-card__badge github-activity-card__badge--potential">
                ${this.t('github.activity.potentialRelease', 'Potential first release')}
            </span>`
            : '';

        return `
            <div class="github-activity-card github-activity-card--active">
                <div class="github-activity-card__header">
                    <a href="${project.repoUrl}" target="_blank" rel="noopener noreferrer" class="github-activity-card__title">
                        <i class='bx bx-code-alt'></i>
                        ${this.escapeHtml(project.repo)}
                    </a>
                    ${potentialRelease}
                </div>
                <p class="github-activity-card__description">${this.escapeHtml(project.repoDescription || '')}</p>
                <div class="github-activity-card__meta">
                    <span class="github-activity-card__stats">
                        <i class='bx bx-git-commit'></i>
                        ${project.commitCount} ${this.t('github.activity.commits', 'commits')} (${this.config.activityDays} ${this.t('github.activity.days', 'days')})
                    </span>
                    <span class="github-activity-card__date">
                        <i class='bx bx-time-five'></i>
                        ${date}
                    </span>
                </div>
                ${project.language ? `
                    <div class="github-activity-card__footer">
                        <span class="github-activity-card__language">
                            <i class='bx bx-code-curly'></i>
                            ${this.escapeHtml(project.language)}
                        </span>
                        ${project.stars > 0 ? `
                            <span class="github-activity-card__stats-small">
                                <i class='bx bx-star'></i> ${project.stars}
                            </span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getLocale() {
        if (window.i18n?.currentLang) {
            return window.i18n.currentLang === 'de' ? 'de-DE' : 'en-US';
        }
        return navigator.language || 'en-US';
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

    applyI18n() {
        if (window.i18n?.applyTranslations) {
            window.i18n.applyTranslations();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
(function() {
    const init = () => {
        const containerEl = document.getElementById('github-activity');
        if (!containerEl) {
            console.warn('GitHub Activity container not found, retrying...');
            setTimeout(init, 500);
            return;
        }

        if (typeof window.githubActivity === 'undefined') {
            window.githubActivity = new GitHubActivity('FaserF');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 100);
        });
    } else {
        setTimeout(init, 100);
    }
})();
