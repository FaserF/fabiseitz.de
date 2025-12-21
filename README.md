# fabiseitz.de

Personal website and portfolio of Fabian Seitz (FaserF) - IT Administrator, Developer & Automation Expert.

## 🌐 Live Website

Visit the website at: [https://fabiseitz.de](https://fabiseitz.de)

## ✨ Features

- **Multilingual Support (i18n)**: Full German (DE) and English (EN) support with dynamic language switching
- **Dark Mode**: Modern dark mode with smooth transitions
- **Responsive Design**: Fully responsive layout for all device sizes
- **Dynamic GitHub Integration**:
  - Live GitHub projects widget with filtering and search
  - Activity widget showing recent releases, active projects, and external PRs
  - **Optimized API Usage**: Centralized GitHub API service with persistent caching to minimize rate limits
- **Modern UI/UX**: Clean, professional design with glassmorphism effects and premium animations
- **PWA Ready**: Progressive Web App support with service worker
- **SEO Optimized**: Meta tags, Open Graph, and Twitter Card support
- **No-Cookie Banner**: Humorous banner explaining the cookie-free experience
- **Multiple Subpages**:
  - CV page with professional experience timeline
  - VHS (Adult Education) page with booking system
  - Profiles page with Steam and Instagram widgets
  - FaserF nickname story page
  - Legal pages (Impressum, Datenschutzerklärung)
- **Telegram Communities**: Section showcasing Telegram groups and channels
- **Contact Form**: With Cloudflare Turnstile bot protection

## 🛠️ Technologies

- **HTML5**: Semantic markup
- **CSS3**: Modern CSS with variables, flexbox, and grid
- **JavaScript (ES6+)**: Vanilla JavaScript for all functionality
- **Boxicons**: Icon library
- **ScrollReveal**: Scroll animations
- **GitHub API**: Dynamic project fetching with optimized caching
- **Cloudflare Turnstile**: Bot protection for contact form
- **LocalStorage**: Persistent caching for API responses

## 📁 Project Structure

```
fabiseitz.de/
├── assets/
│   ├── css/
│   │   └── styles.css          # Main stylesheet
│   ├── i18n/
│   │   ├── de.json             # German translations
│   │   └── en.json             # English translations
│   ├── img/                     # Images and favicons
│   └── js/
│       ├── i18n.js                  # Internationalization module
│       ├── github-api-service.js    # Centralized GitHub API service with caching
│       ├── github-widget.js         # GitHub projects widget
│       ├── github-activity.js       # GitHub activity widget
│       ├── main.js                  # Main JavaScript
│       ├── no-cookie-banner.js      # No-cookie banner functionality
│       ├── vhs-booking.js           # VHS booking form handler
│       └── serviceWorker.js         # PWA service worker
├── index.html                       # Main page
├── cv.html                          # CV/Resume page
├── vhs.html                          # VHS (Adult Education) page
├── faserf.html                      # FaserF nickname story page
├── profiles.html                    # Social profiles page
├── impressum.html                   # Legal imprint page
├── datenschutzerklaerung.html       # Privacy policy page
├── package.json                     # npm configuration
├── site.webmanifest                 # PWA manifest
└── README.md                        # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/FaserF/fabiseitz.de.git
cd fabiseitz.de
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

### Development

The website is a static site that can be served with any web server. For local development:

1. **Using Python**:
```bash
python -m http.server 8000
```

2. **Using Node.js** (with http-server):
```bash
npx http-server -p 8000
```

3. **Using VS Code Live Server**: Open the project in VS Code and use the Live Server extension

Then open `http://localhost:8000` in your browser.

**Note**: Some features (like i18n JSON loading and GitHub API) require HTTP/HTTPS and won't work with `file://` protocol.

## 🧪 Testing

The project includes automated tests:

- **i18n Tests**: Validates translation files and checks for missing keys
- **Lint Tests**: Checks for common HTML/CSS/JS issues

Run all tests:
```bash
npm test
```

Run specific tests:
```bash
npm run test:i18n  # i18n tests only
npm run lint       # lint tests only
```

## 📝 Adding Translations

1. Edit the translation files in `assets/i18n/`:
   - `de.json` for German
   - `en.json` for English

2. Use the same key structure in both files:
```json
{
  "section": {
    "key": "Translation text"
  }
}
```

3. Add `data-i18n="section.key"` attribute to HTML elements

4. Run i18n tests to ensure consistency:
```bash
npm run test:i18n
```

## 🎨 Customization

### Colors and Theme

Edit CSS variables in `assets/css/styles.css`:
```css
:root {
  --color-primary: #667eea;
  --color-primary-light: #764ba2;
  /* ... more variables ... */
}
```

### Adding New Sections

1. Add HTML structure in `index.html`
2. Add translations in `assets/i18n/de.json` and `assets/i18n/en.json`
3. Style in `assets/css/styles.css`
4. Add any JavaScript functionality in `assets/js/main.js`

## 🔧 GitHub Integration

### GitHub Projects Widget

The website dynamically fetches and displays all public GitHub repositories:
- Automatic filtering of forks
- Search functionality
- Language-based filtering
- Sort by update date
- **Optimized API calls**: Uses centralized API service with persistent caching

### GitHub Activity Widget

Shows interesting GitHub activities:
- Recent releases from projects (last 30 days)
- Projects with high commit activity (potential upcoming releases)
- External pull requests to other developers' projects
- **Efficient API usage**: Batch requests and intelligent caching to minimize rate limits

### GitHub API Service

Centralized API management with:
- **Persistent caching**: localStorage-based caching with TTL (Time To Live)
- **Rate limit tracking**: Monitors and respects GitHub API rate limits
- **Batch requests**: Optimized batch fetching for multiple repositories
- **Request deduplication**: Prevents duplicate concurrent requests
- **Automatic cache cleanup**: Removes expired cache entries

## 📄 Pages

- **Home (`index.html`)**: Main landing page with overview, skills, projects, and GitHub activity
- **CV (`cv.html`)**: Full CV/Resume with professional experience, education, and skills
- **VHS (`vhs.html`)**: Adult Education page with FAQ, availability, and booking form
- **FaserF (`faserf.html`)**: Story behind the FaserF nickname
- **Profiles (`profiles.html`)**: Links to Steam and Instagram profiles with widgets
- **Impressum (`impressum.html`)**: Legal imprint information
- **Datenschutzerklärung (`datenschutzerklaerung.html`)**: Privacy policy

## 🌍 Deployment

The website is deployed on **Cloudflare Pages**:
- Automatic deployments from GitHub
- CDN distribution
- HTTPS enabled
- Custom domain support

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on push and pull requests
- Tests i18n translations
- Lints code
- Ensures code quality

### Beta Environment Setup
To set up the `beta.fabiseitz.de` environment which always points to the latest changes:

1.  **Cloudflare DNS (CNAME)**:
    *   Add a CNAME record: `beta` -> `your-pages-project-name.pages.dev` (or the specific branch alias if using Cloudflare Pages branch deployments, e.g., `beta.fabiseitz-de.pages.dev`).
    *   Ideally, configure your deployment system (Cloudflare Pages) to build the `beta` branch (or `develop` branch) to a specific URL alias, and point the CNAME there.

2.  **Cloudflare Workers**:
    *   The site logic (`assets/js/config.js`) differentiates between `beta` (including `localhost`) and `production`.
    *   **Beta**: Uses `beta.contacttomail.fabiseitz.de` and `beta.api.fabiseitz.de` (for calendar).
    *   **Production**: Uses `contacttomail.fabiseitz.de` and falls back to `api.allorigins.win` (for calendar) until you configure `api.fabiseitz.de`.
    *   **Action Required**:
        *   Create Cloudflare Workers for `beta` subdomains (or use Routes/Triggers in the same worker based on Host header).
        *   Ensure `beta.api.fabiseitz.de` (or your worker choice) is handling the calendar proxy request.
        *   Ensure `beta.contacttomail.fabiseitz.de` is handling the contact form.

### Cloudflare Integration
... (rest of section) ...
2
3### Cloudflare Worker (CORS Proxy & Captcha)

To enable secure access to external APIs (like Google Calendar) and provide Captcha protection without exposing API keys or running into CORS issues, this project uses a Cloudflare Worker.

#### Setup Instructions

1. **Create a Cloudflare Worker**:
   - Go to Cloudflare Dashboard > Workers & Pages
   - Create a new Worker (e.g., `fabiseitz-api-proxy`)

2. **Deploy the Worker Code**:
   - The worker acts as a proxy for:
     - Google Calendar (iCal fetch)
     - Telegram API (optional)
     - Contact Form submission (Email forwarding)
   - It also validates Cloudflare Turnstile tokens.

   Basic example code structure:
   ```javascript
   export default {
     async fetch(request, env) {
       const url = new URL(request.url);

       // Handle CORS preflight
       if (request.method === "OPTIONS") {
         return new Response(null, {
           headers: {
             "Access-Control-Allow-Origin": "*",
             "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
             "Access-Control-Allow-Headers": "Content-Type",
           },
         });
       }

       // Proxy logic here...
       // fetch(targetUrl, ...)
     }
   }
   ```

3. **Configure Calendar Proxy**:
   - In `assets/js/vhs-calendar.js`, update the `CORS_PROXY` variable to point to your Worker URL:
   ```javascript
   const CORS_PROXY = 'https://your-worker.your-subdomain.workers.dev/?url=';
   ```

4. **Configure Turnstile Captcha**:
   - Get your Site Key and Secret Key from Cloudflare Dashboard > Turnstile.
   - Add the Site Key to the `.cf-turnstile` div in `index.html`.
   - Use the Secret Key in your Worker to validate the token on form submission.

## 📦 Dependencies

### Runtime Dependencies
- None (vanilla JavaScript)

### Development Dependencies
- Node.js (for testing)

### External Resources
- Boxicons CDN
- ScrollReveal CDN
- GitHub API (with optimized caching)
- Cloudflare Turnstile
- Steam Community Widget
- Telegram (for community widgets)

## 🤝 Contributing

This is a personal website, but suggestions and improvements are welcome! Please open an issue or pull request.

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**Fabian Seitz (FaserF)**
- Website: [https://fabiseitz.de](https://fabiseitz.de)
- GitHub: [@FaserF](https://github.com/FaserF)
- LinkedIn: [fabiseitz](https://www.linkedin.com/in/fabiseitz/)

## 🙏 Acknowledgments

- Design inspired by modern portfolio templates
- Icons by [Boxicons](https://boxicons.com/)
- Animations by [ScrollReveal](https://scrollrevealjs.org/)

---

Made with ❤️ by Fabian Seitz
