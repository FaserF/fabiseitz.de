// loadContent.js
function loadHTMLContent() {
    const footerElement = document.querySelector('footer');
    // Load footer only if it's empty
    if (footerElement && footerElement.innerHTML.trim() === '') {
        fetch('/assets/html/footer.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not OK');
                }
                return response.text();
            })
            .then(data => {
                footerElement.innerHTML = data;
                console.log('Footer loaded successfully.');
            })
            .catch(error => {
                console.error('Error loading footer:', error);
            });
    } else {
        console.log('Footer already contains content. Skipping load.');
    }
}

// Call function on page load
document.addEventListener('DOMContentLoaded', loadHTMLContent);
