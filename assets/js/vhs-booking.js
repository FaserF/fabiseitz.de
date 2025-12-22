/**
 * VHS Booking Form Handler
 * Handles booking request form submissions via Graph API (like contact form)
 */

(function () {
    const init = () => {
        const form = document.getElementById('vhs-booking-form');
        if (!form) return;

        form.addEventListener('submit', handleSubmit);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);

        // Get submit button and disable it
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.textContent;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = submitButton.getAttribute('data-i18n') ?
                (window.i18n?.t('vhs.booking.form.submitting') || 'Wird gesendet...') :
                'Wird gesendet...';
        }

        // Get success message element
        const successEl = document.getElementById('vhs-booking-success');
        const errorEl = document.getElementById('vhs-booking-error');

        try {
            // Create email body
            const emailBody = createEmailBody(formData);

            // Submit to Graph API endpoint (same as contact form)
            const contactUrl = window.SITE_CONFIG?.endpoints?.contactForm || 'https://contacttomail.fabiseitz.de/';

            const payload = {
                firstname: formData.get('name')?.split(' ')[0] || '',
                lastname: formData.get('name')?.split(' ').slice(1).join(' ') || '',
                mail: formData.get('email') || '',
                phone: formData.get('phone') || '',
                message: formData.get('message') || '',
                preferredDate: formData.get('preferredDate') || '',
                preferredTime: formData.get('preferredTime') || '',
                startDate: calculateStartTimestamp(formData.get('preferredDate'), formData.get('preferredTime')),
                endDate: calculateEndTimestamp(formData.get('preferredDate'), formData.get('preferredTime')),
                subject: 'VHS Booking: ' + (formData.get('name') || 'Unknown')
            };

            // Helper to try fetch with optional proxy
            const trySubmit = async (url, useProxy = false) => {
                const fetchUrl = useProxy ? 'https://corsproxy.io/?' + encodeURIComponent(url) : url;

                // IMPORTANT: When using corsproxy.io for POST, we must follow their specific pattern if needed,
                // but standard header proxying usually works for simple JSON APIs.
                // However, corsproxy.io might NOT support POST bodies correctly in all cases or strips headers.
                // An alternative is to just try direct, and if it fails, warn user.
                // BUT: User specifically has CORS error.

                // Let's try direct first.
                console.log(`Submitting to ${fetchUrl} (Proxy: ${useProxy})`);

                const response = await fetch(fetchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`Status ${response.status}`);
                return response;
            };

            let response;
            try {
                // 1. Try Direct
                response = await trySubmit(contactUrl, false);
            } catch (directErr) {
                console.warn('Direct submission failed, trying proxy...', directErr);
                try {
                    // 2. Try Proxy
                    // Note: 'corsproxy.io' supports POST? Documentation says yes for some, but let's test.
                    // If this fails, we really are out of luck without a backend fix.
                    response = await trySubmit(contactUrl, true);
                } catch (proxyErr) {
                    console.error('All submission attempts failed', proxyErr);
                    throw proxyErr; // Throw original or proxy error to trigger catch block below
                }
            }

            if (response.ok) {
                // Show success message
                if (successEl) {
                    successEl.style.display = 'block';
                    form.style.display = 'none';
                    successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error('Error submitting booking form:', error);

            // Show error message
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                alert(window.i18n?.t('vhs.booking.error') || 'Fehler beim Senden der Buchungsanfrage. Bitte versuchen Sie es erneut oder kontaktieren Sie mich direkt per E-Mail.');
            }

            // Re-enable submit button
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    };

    const createEmailBody = (formData) => {
        const t = (key, fallback) => {
            if (window.i18n?.t) {
                const translation = window.i18n.t(key);
                if (translation && translation !== key) {
                    return translation;
                }
            }
            return fallback;
        };

        let body = t('vhs.booking.emailBody', 'VHS Buchungsanfrage\n\n');
        body += `Name: ${formData.get('name') || ''}\n`;
        body += `E-Mail: ${formData.get('email') || ''}\n`;
        if (formData.get('phone')) {
            body += `Telefon: ${formData.get('phone')}\n`;
        }
        if (formData.get('preferredDate')) {
            body += `Bevorzugtes Datum: ${formData.get('preferredDate')}\n`;
        }
        if (formData.get('preferredTime')) {
            body += `Bevorzugte Uhrzeit: ${formData.get('preferredTime')}\n`;
        }
        if (formData.get('message')) {
            body += `\nNachricht:\n${formData.get('message')}\n`;
        }

        return body;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    const calculateStartTimestamp = (dateStr, timeSlotStr) => {
        if (!dateStr || !timeSlotStr) return null;
        try {
            // Check if format is HH:MM-HH:MM
            if (!timeSlotStr.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) return null;

            // timeSlotStr format: "HH:MM-HH:MM" -> "18:00-18:45"
            const startTime = timeSlotStr.split('-')[0]; // "18:00"
            return `${dateStr}T${startTime}:00`; // "2023-10-24T18:00:00" (Local time)
        } catch (e) {
            console.error('Error calculating start timestamp:', e);
            return null;
        }
    };

    const calculateEndTimestamp = (dateStr, timeSlotStr) => {
        if (!dateStr || !timeSlotStr) return null;
        try {
            // Check if format is HH:MM-HH:MM
            if (!timeSlotStr.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) return null;

            // timeSlotStr format: "HH:MM-HH:MM" -> "18:00-18:45"
            const endTime = timeSlotStr.split('-')[1]; // "18:45"
            return `${dateStr}T${endTime}:00`; // "2023-10-24T18:45:00" (Local time)
        } catch (e) {
            console.error('Error calculating end timestamp:', e);
            return null;
        }
    };
})();
