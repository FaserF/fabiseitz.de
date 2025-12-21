/**
 * GitHub Projects Widget
 * Dynamically loads and displays GitHub repositories
 */

class GitHubWidget {
    constructor(username = 'FaserF') {
        this.username = username;
        this.repos = [];
        this.filteredRepos = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadRepositories();
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('github-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterRepositories();
            });
        }

        // Filter buttons
        const filterButtons = document.querySelectorAll('.github-filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.filterRepositories();
            });
        });
    }

    async loadRepositories() {
        const loadingEl = document.getElementById('github-loading');
        const errorEl = document.getElementById('github-error');
        const gridEl = document.getElementById('github-projects-grid');

        try {
            loadingEl.style.display = 'flex';
            errorEl.style.display = 'none';

            // Use GitHub API (public repos, no auth needed for basic info)
            const response = await fetch(`https://api.github.com/users/${this.username}/repos?sort=updated&per_page=100&type=all`);

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();

            // Filter out forks and sort by updated date
            this.repos = data
                .filter(repo => !repo.fork)
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

            this.filteredRepos = [...this.repos];
            this.renderRepositories();

            loadingEl.style.display = 'none';
        } catch (error) {
            console.error('Error loading GitHub repositories:', error);
            loadingEl.style.display = 'none';
            errorEl.style.display = 'flex';
        }
    }

    filterRepositories() {
        let filtered = [...this.repos];

        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(repo =>
                repo.name.toLowerCase().includes(this.searchTerm) ||
                (repo.description && repo.description.toLowerCase().includes(this.searchTerm)) ||
                (repo.language && repo.language.toLowerCase().includes(this.searchTerm))
            );
        }

        // Apply sort filter
        switch (this.currentFilter) {
            case 'language':
                filtered.sort((a, b) => {
                    const langA = a.language || 'Other';
                    const langB = b.language || 'Other';
                    return langA.localeCompare(langB);
                });
                break;
            case 'updated':
                filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                break;
            default:
                // Already sorted by updated
                break;
        }

        this.filteredRepos = filtered;
        this.renderRepositories();
    }

    renderRepositories() {
        const gridEl = document.getElementById('github-projects-grid');
        if (!gridEl) return;

        if (this.filteredRepos.length === 0) {
            gridEl.innerHTML = `
                <div class="github-project__empty">
                    <i class='bx bx-search-alt-2'></i>
                    <p data-i18n="github.noResults">Keine Projekte gefunden</p>
                </div>
            `;
            // Apply i18n if available
            if (window.i18n) {
                window.i18n.applyTranslations();
            }
            return;
        }

        gridEl.innerHTML = this.filteredRepos.map(repo => this.createRepoCard(repo)).join('');
    }

    createRepoCard(repo) {
        const language = repo.language || 'Other';
        const description = repo.description || 'Keine Beschreibung verfügbar';
        const updatedDate = new Date(repo.updated_at).toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const stars = repo.stargazers_count || 0;
        const forks = repo.forks_count || 0;

        // Get language color (common colors)
        const languageColors = {
            'Python': '#3776ab',
            'JavaScript': '#f7df1e',
            'TypeScript': '#3178c6',
            'HTML': '#e34c26',
            'CSS': '#1572b6',
            'Shell': '#89e051',
            'PowerShell': '#012456',
            'Dockerfile': '#384d54',
            'Other': '#6e7681'
        };
        const langColor = languageColors[language] || languageColors['Other'];

        return `
            <div class="github-project-card">
                <div class="github-project-card__header">
                    <a href="${repo.html_url}" target="_blank" class="github-project-card__title">
                        <i class='bx bx-code-alt'></i>
                        ${this.escapeHtml(repo.name)}
                    </a>
                    ${repo.private ? '<span class="github-project-card__private">Private</span>' : ''}
                </div>
                <p class="github-project-card__description">${this.escapeHtml(description)}</p>
                <div class="github-project-card__meta">
                    <span class="github-project-card__language" style="--lang-color: ${langColor}">
                        <span class="github-project-card__language-dot"></span>
                        ${this.escapeHtml(language)}
                    </span>
                    <span class="github-project-card__stats">
                        <i class='bx bx-star'></i> ${stars}
                        <i class='bx bx-git-branch'></i> ${forks}
                    </span>
                </div>
                <div class="github-project-card__footer">
                    <span class="github-project-card__updated">
                        <i class='bx bx-time-five'></i>
                        Aktualisiert: ${updatedDate}
                    </span>
                    <a href="${repo.html_url}" target="_blank" class="github-project-card__link">
                        <i class='bx bx-link-external'></i>
                    </a>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.githubWidget = new GitHubWidget('FaserF');
    });
} else {
    window.githubWidget = new GitHubWidget('FaserF');
}
