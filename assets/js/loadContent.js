// loadContent.js
function loadHTMLContent() {
    fetch('assets/html/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Netzwerkantwort war nicht OK');
            }
            return response.text();
        })
        .then(data => {
            document.querySelector('header').innerHTML = data;
        })
        .catch(error => {
            console.error('Fehler beim Laden des Headers:', error);
        });

    fetch('assets/html/footer.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Netzwerkantwort war nicht OK');
            }
            return response.text();
        })
        .then(data => {
            document.querySelector('footer').innerHTML = data;
        })
        .catch(error => {
            console.error('Fehler beim Laden des Footers:', error);
        });
}

// Rufe die Funktion beim Laden der Seite auf
document.addEventListener('DOMContentLoaded', loadHTMLContent);
