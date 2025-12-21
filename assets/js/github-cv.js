/**
 * GitHub CV - Displays GitHub statistics, achievements, and project history
 */

class GitHubCV {
    constructor() {
        this.api = window.githubAPIService;
        this.username = 'FaserF';
        this.init();
    }

    async init() {
        if (!this.api) {
            console.error('GitHub API Service not available');
            this.showError();
            return;
        }

        // Listen for language changes to re-render
        window.addEventListener('languageChanged', () => this.renderAll());
        window.addEventListener('i18nInitialized', () => this.renderAll());

        try {
            await this.loadData();
        } catch (error) {
            console.error('Error loading GitHub CV data:', error);
            this.showError();
        }
    }

    async loadData() {
        this.showLoading();

        // Get all repositories
        const repos = await this.api.getUserRepositories();
        if (!repos || repos.length === 0) {
            this.showError();
            return;
        }

        // Filter out forks for statistics
        const ownRepos = repos.filter(repo => !repo.fork);

        // Pre-calculate expensive non-locale data if any (stats is async)
        const stats = await this.calculateStats(ownRepos);

        // Store data for re-rendering
        this.data = {
            repos: ownRepos,
            stats: stats
        };

        this.renderAll();

        this.hideLoading();
        this.showContent();
    }

    renderAll() {
        if (!this.data || !this.data.repos) return;

        const { repos, stats } = this.data;

        // Re-calculate locale-dependent data
        const yearlyData = this.calculateYearlyData(repos);
        const focusChanges = this.identifyFocusChanges(repos);
        const achievements = this.calculateAchievements(repos, stats);
        const recentProjects = this.getRecentProjects(repos);

        this.renderStats(stats);
        this.renderYearlyData(yearlyData);
        this.renderFocusChanges(focusChanges);
        this.renderAchievements(achievements);
        this.renderRecentProjects(recentProjects);
    }

    async calculateStats(repos) {
        let totalCommits = 0;
        let totalStars = 0;
        let totalContributions = 0;

        // Get commit counts for each repo (limited to avoid rate limits)
        const reposToCheck = repos.slice(0, 20); // Limit to 20 most recent repos
        const commitCounts = await this.api.batchGetCommits(
            reposToCheck.map(r => r.full_name),
            null,
            1 // Just check if repo has commits
        );

        repos.forEach(repo => {
            totalStars += repo.stargazers_count || 0;
            totalContributions += repo.contributors_count || 0;
        });

        // Estimate total commits (we can't get exact count without pagination)
        totalCommits = repos.length * 50; // Rough estimate

        return {
            totalCommits,
            totalRepos: repos.length,
            totalStars,
            totalContributions
        };
    }

    calculateYearlyData(repos) {
        const yearly = {};

        repos.forEach(repo => {
            const createdYear = new Date(repo.created_at).getFullYear();
            const updatedYear = new Date(repo.updated_at).getFullYear();

            // Count new repos per year
            if (!yearly[createdYear]) {
                yearly[createdYear] = {
                    year: createdYear,
                    newRepos: 0,
                    activeRepos: 0,
                    languages: new Set()
                };
            }
            yearly[createdYear].newRepos++;

            // Track active repos (updated in that year)
            if (!yearly[updatedYear]) {
                yearly[updatedYear] = {
                    year: updatedYear,
                    newRepos: 0,
                    activeRepos: 0,
                    languages: new Set()
                };
            }
            yearly[updatedYear].activeRepos++;

            // Track languages
            if (repo.language) {
                yearly[updatedYear].languages.add(repo.language);
            }
        });

        // Convert to array and sort
        return Object.values(yearly)
            .sort((a, b) => b.year - a.year)
            .map(year => ({
                ...year,
                languages: Array.from(year.languages)
            }));
    }

    identifyFocusChanges(repos) {
        // Group repos by primary language and year
        const focusByYear = {};

        repos.forEach(repo => {
            const year = new Date(repo.updated_at).getFullYear();
            const language = repo.language || 'Other';

            if (!focusByYear[year]) {
                focusByYear[year] = {};
            }
            if (!focusByYear[year][language]) {
                focusByYear[year][language] = 0;
            }
            focusByYear[year][language]++;
        });

        // Identify significant shifts
        const changes = [];
        const years = Object.keys(focusByYear).sort((a, b) => b - a);

        for (let i = 0; i < years.length - 1; i++) {
            const currentYear = parseInt(years[i]);
            const prevYear = parseInt(years[i + 1]);
            const current = focusByYear[currentYear];
            const previous = focusByYear[prevYear];

            // Find top language in each year
            const currentTop = Object.entries(current)
                .sort((a, b) => b[1] - a[1])[0];
            const prevTop = Object.entries(previous)
                .sort((a, b) => b[1] - a[1])[0];

            if (currentTop[0] !== prevTop[0]) {
                changes.push({
                    year: currentYear,
                    from: prevTop[0],
                    to: currentTop[0],
                    repos: currentTop[1]
                });
            }
        }

        return changes;
    }

    calculateAchievements(repos, stats) {
        const achievements = [];

        // Achievement: First Repository
        if (repos.length > 0) {
            const firstRepo = repos.sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
            )[0];
            achievements.push({
                icon: 'bx-code-alt',
                title: this.getTranslation('githubCv.achievements.firstRepo.title', 'Erstes Repository'),
                description: this.getTranslation('githubCv.achievements.firstRepo.description', `"${firstRepo.name}" erstellt`),
                date: new Date(firstRepo.created_at).getFullYear()
            });
        }

        // Achievement: 10+ Repositories
        if (stats.totalRepos >= 10) {
            achievements.push({
                icon: 'bx-folder',
                title: this.getTranslation('githubCv.achievements.manyRepos.title', '10+ Repositories'),
                description: this.getTranslation('githubCv.achievements.manyRepos.description', `${stats.totalRepos} eigene Projekte`),
                date: new Date().getFullYear()
            });
        }

        // Achievement: Popular Project (10+ stars)
        const popularRepos = repos.filter(r => r.stargazers_count >= 10);
        if (popularRepos.length > 0) {
            achievements.push({
                icon: 'bx-star',
                title: this.getTranslation('githubCv.achievements.popular.title', 'Beliebtes Projekt'),
                description: this.getTranslation('githubCv.achievements.popular.description', `${popularRepos.length} Projekt(e) mit 10+ Sternen`),
                date: new Date().getFullYear()
            });
        }

        // Achievement: Active Developer
        if (stats.totalRepos >= 5) {
            achievements.push({
                icon: 'bx-git-commit',
                title: this.getTranslation('githubCv.achievements.active.title', 'Aktiver Entwickler'),
                description: this.getTranslation('githubCv.achievements.active.description', 'Kontinuierliche Projektentwicklung'),
                date: new Date().getFullYear()
            });
        }

        // Achievement: Multi-language
        const languages = new Set(repos.map(r => r.language).filter(Boolean));
        if (languages.size >= 3) {
            achievements.push({
                icon: 'bx-code-curly',
                title: this.getTranslation('githubCv.achievements.multilang.title', 'Multi-Sprache'),
                description: this.getTranslation('githubCv.achievements.multilang.description', `Projekte in ${languages.size} Sprachen`),
                date: new Date().getFullYear()
            });
        }

        return achievements;
    }

    getRecentProjects(repos) {
        return repos
            .filter(r => !r.fork)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 6)
            .map(repo => ({
                name: repo.name,
                description: repo.description || this.getTranslation('githubCv.noDescription', 'Keine Beschreibung'),
                language: repo.language || 'Other',
                stars: repo.stargazers_count || 0,
                updated: repo.updated_at,
                url: repo.html_url
            }));
    }

    renderStats(stats) {
        document.getElementById('total-commits').textContent = this.formatNumber(stats.totalCommits);
        document.getElementById('total-repos').textContent = stats.totalRepos;
        document.getElementById('total-stars').textContent = this.formatNumber(stats.totalStars);
        document.getElementById('total-contributions').textContent = this.formatNumber(stats.totalContributions);
    }

    renderYearlyData(yearlyData) {
        const container = document.getElementById('yearly-breakdown');
        container.innerHTML = '';

        yearlyData.forEach(year => {
            const yearUrl = `https://github.com/${this.username}?tab=repositories&q=&type=&language=&sort=&created=${year.year}-01-01..${year.year}-12-31`;
            const card = document.createElement('a');
            card.href = yearUrl;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'github-cv__year-card github-cv__year-card--clickable';
            card.innerHTML = `
                <div class="github-cv__year-header">
                    <h4 class="github-cv__year-title">${year.year}</h4>
                    <i class='bx bx-link-external github-cv__link-icon'></i>
                </div>
                <div class="github-cv__year-stats">
                    <div class="github-cv__year-stat">
                        <i class='bx bx-folder'></i>
                        <span>${year.newRepos} ${this.getTranslation('githubCv.yearly.newRepos', 'neue Repos')}</span>
                    </div>
                    <div class="github-cv__year-stat">
                        <i class='bx bx-code-alt'></i>
                        <span>${year.activeRepos} ${this.getTranslation('githubCv.yearly.activeRepos', 'aktive Repos')}</span>
                    </div>
                </div>
                ${year.languages.length > 0 ? `
                    <div class="github-cv__year-languages">
                        ${year.languages.map(lang => `<span class="github-cv__language-tag">${lang}</span>`).join('')}
                    </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
    }

    renderFocusChanges(focusChanges) {
        const container = document.getElementById('focus-changes');
        container.innerHTML = '';

        if (focusChanges.length === 0) {
            container.innerHTML = `<p class="github-cv__empty">${this.getTranslation('githubCv.focus.noChanges', 'Keine signifikanten Fokuswechsel erkannt.')}</p>`;
            return;
        }

        focusChanges.forEach(change => {
            const languageUrl = `https://github.com/${this.username}?tab=repositories&q=&type=&language=${encodeURIComponent(change.to)}&sort=`;
            const item = document.createElement('a');
            item.href = languageUrl;
            item.target = '_blank';
            item.rel = 'noopener noreferrer';
            item.className = 'github-cv__focus-item github-cv__focus-item--clickable';
            item.innerHTML = `
                <div class="github-cv__focus-year">${change.year}</div>
                <div class="github-cv__focus-content">
                    <i class='bx bx-transfer'></i>
                    <span>${this.getTranslation('githubCv.focus.shift', 'Fokuswechsel')}: <strong>${change.from}</strong> → <strong>${change.to}</strong></span>
                    <span class="github-cv__focus-repos">(${change.repos} ${this.getTranslation('githubCv.focus.repos', 'Repos')})</span>
                </div>
                <i class='bx bx-link-external github-cv__link-icon'></i>
            `;
            container.appendChild(item);
        });
    }

    renderAchievements(achievements) {
        const container = document.getElementById('achievements');
        container.innerHTML = '';

        achievements.forEach(achievement => {
            const card = document.createElement('div');
            card.className = 'github-cv__achievement-card';
            card.innerHTML = `
                <i class='bx ${achievement.icon} github-cv__achievement-icon'></i>
                <div class="github-cv__achievement-content">
                    <h4 class="github-cv__achievement-title">${achievement.title}</h4>
                    <p class="github-cv__achievement-description">${achievement.description}</p>
                    <span class="github-cv__achievement-date">${achievement.date}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderRecentProjects(projects) {
        const container = document.getElementById('recent-projects');
        container.innerHTML = '';

        projects.forEach(project => {
            const card = document.createElement('a');
            card.href = project.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'github-cv__project-card github-cv__project-card--clickable';
            card.innerHTML = `
                <div class="github-cv__project-header">
                    <h4 class="github-cv__project-name">${project.name}</h4>
                    <div class="github-cv__project-meta">
                        ${project.stars > 0 ? `
                            <span class="github-cv__project-stars">
                                <i class='bx bx-star'></i> ${project.stars}
                            </span>
                        ` : ''}
                        <i class='bx bx-link-external github-cv__link-icon'></i>
                    </div>
                </div>
                <p class="github-cv__project-description">${this.escapeHtml(project.description)}</p>
                <div class="github-cv__project-footer">
                    <span class="github-cv__project-language">${project.language}</span>
                    <span class="github-cv__project-updated">
                        ${this.getTranslation('githubCv.updated', 'Aktualisiert')}: ${this.formatDate(project.updated)}
                    </span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    showLoading() {
        document.getElementById('github-cv-loading').style.display = 'block';
        document.getElementById('github-cv-error').style.display = 'none';
        document.getElementById('github-cv-content').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('github-cv-loading').style.display = 'none';
    }

    showContent() {
        document.getElementById('github-cv-content').style.display = 'block';
    }

    showError() {
        document.getElementById('github-cv-loading').style.display = 'none';
        document.getElementById('github-cv-content').style.display = 'none';
        document.getElementById('github-cv-error').style.display = 'block';
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const locale = window.i18n?.currentLang || navigator.language || 'de-DE';
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getTranslation(key, fallback) {
        if (window.i18n && window.i18n.t) {
            return window.i18n.t(key) || fallback;
        }
        return fallback;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('github-cv')) {
        new GitHubCV();
    }
});
