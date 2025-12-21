/*===== MENU SHOW =====*/
const showMenu = (toggleId, navId) => {
    const toggle = document.getElementById(toggleId),
        nav = document.getElementById(navId);

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            nav.classList.toggle('show');
        });
    }
}
showMenu('nav-toggle', 'nav-menu');

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link');

function linkAction() {
    const navMenu = document.getElementById('nav-menu');
    navMenu.classList.remove('show');
}
navLink.forEach(n => n.addEventListener('click', linkAction));

/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]');

const scrollActive = () => {
    const scrollDown = window.scrollY;

    sections.forEach(current => {
        const sectionHeight = current.offsetHeight,
            sectionTop = current.offsetTop - 58,
            sectionId = current.getAttribute('id'),
            sectionsClass = document.querySelector('.nav__menu a[href*=' + sectionId + ']');

        if (sectionsClass) {
            if (scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight) {
                sectionsClass.classList.add('active-link');
            } else {
                sectionsClass.classList.remove('active-link');
            }
        }
    });
}
window.addEventListener('scroll', scrollActive);

/*===== SCROLL REVEAL ANIMATION =====*/
const sr = ScrollReveal({
    origin: 'top',
    distance: '60px',
    duration: 2000,
    delay: 200,
    reset: false, // Don't reset on scroll up
    viewFactor: 0.1, // Trigger when element is 10% visible
});

// Initialize animations - ensure they run even if page is loaded with hash or after reload
const initScrollReveal = () => {
    // Reset and re-reveal to ensure animations work on page reload
    sr.reveal('.home__data, .about__img, .skills__subtitle, .skills__text', {
        reset: false,
        viewFactor: 0.1
    });
    sr.reveal('.home__img, .about__subtitle, .about__text, .skills__img', {
        delay: 400,
        reset: false,
        viewFactor: 0.1
    });
    sr.reveal('.home__social-icon', {
        interval: 200,
        reset: false,
        viewFactor: 0.1
    });
    sr.reveal('.skills__data, .work__img, .contact__input', {
        interval: 200,
        reset: false,
        viewFactor: 0.1
    });

    // Force reveal for home section if it's in viewport on load
    const homeData = document.querySelector('.home__data');
    if (homeData) {
        const rect = homeData.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible) {
            // If home section is visible on load, ensure it's readable immediately
            // The CSS animation will handle the fade-in
            homeData.style.opacity = '1';
            homeData.style.transform = 'translateY(0)';
        }
    }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initScrollReveal, 100);
    });
} else {
    setTimeout(initScrollReveal, 100);
}

// Re-initialize on hash change (when navigating to anchors)
window.addEventListener('hashchange', () => {
    setTimeout(initScrollReveal, 100);
});

/*===== DARK MODE TOGGLE =====*/
const darkModeToggle = document.getElementById('dark-mode-toggle');
const darkModeIcon = document.getElementById('dark-mode-icon');

const updateToggleIcon = () => {
    if (darkModeIcon) {
        if (document.body.classList.contains('dark-mode')) {
            darkModeIcon.className = 'bx bx-sun'; // Sonne für Dark Mode
        } else {
            darkModeIcon.className = 'bx bx-moon'; // Mond für Light Mode
        }
    }
};

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        updateToggleIcon(); // Symbol aktualisieren
    });
}

// Funktion zum Aktivieren des Dark Mode
const enableDarkMode = () => {
    document.body.classList.add('dark-mode');
    updateToggleIcon(); // Symbol aktualisieren
};

// Funktion zum Deaktivieren des Dark Mode
const disableDarkMode = () => {
    document.body.classList.remove('dark-mode');
    updateToggleIcon(); // Symbol aktualisieren
};

// Initial icon update
updateToggleIcon();

// Überprüfen, ob der Dark Mode in den Systemeinstellungen aktiviert ist
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

if (prefersDarkScheme.matches) {
    enableDarkMode(); // Aktiviere Dark Mode, wenn es in den Systemeinstellungen aktiviert ist
}

// Event Listener für Änderungen in den Systemeinstellungen
prefersDarkScheme.addEventListener('change', (event) => {
    if (event.matches) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
});