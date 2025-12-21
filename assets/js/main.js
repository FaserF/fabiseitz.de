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

        if (scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight) {
            sectionsClass.classList.add('active-link');
        } else {
            sectionsClass.classList.remove('active-link');
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
});

sr.reveal('.home__data, .about__img, .skills__subtitle, .skills__text', {});
sr.reveal('.home__img, .about__subtitle, .about__text, .skills__img', { delay: 400 });
sr.reveal('.home__social-icon', { interval: 200 });
sr.reveal('.skills__data, .work__img, .contact__input', { interval: 200 });

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