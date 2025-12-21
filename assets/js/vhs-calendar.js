/**
 * VHS Calendar Integration
 * Fetches Google Calendar events and filters for VHS availability
 */

(function () {
    // VHS availability times (in 24h format)
    const VHS_AVAILABILITY = {
        weekdays: { start: '18:30', end: '21:00' }, // Mon-Thu
        friday: { start: '16:30', end: '19:30' },
        weekend: { start: '10:00', end: '18:00' } // Sat-Sun
    };

    const CALENDAR_ICAL_URL = 'https://calendar.google.com/calendar/ical/20f927fc2cd88c728aa298e86fd00973456fd5f875e0eed0cc4e98eb6260dbad%40group.calendar.google.com/public/basic.ics';

    let calendarEvents = [];
    let availableSlots = [];

    const init = () => {
        // Only initialize if calendar URL is configured
        if (!CALENDAR_ICAL_URL) {
            console.warn('VHS Calendar: No calendar URL configured');
            showFallbackMessage();
            return;
        }

        // Skip calendar loading if running from file:// protocol (CORS restrictions)
        if (window.location.protocol === 'file:') {
            console.warn('VHS Calendar: Cannot load calendar from file:// protocol due to CORS restrictions.');
            showFallbackMessage();
            return;
        }

        loadCalendarEvents();
        setupFormFilters();
    };

    /**
     * Show fallback message when calendar cannot be loaded
     */
    const showFallbackMessage = () => {
        const getTranslation = (key, fallback) => {
            return window.i18n?.t(key) || fallback;
        };

        // Update description text
        const descriptionEl = document.querySelector('.vhs__calendar-description');
        if (descriptionEl) {
            descriptionEl.innerHTML = getTranslation('vhs.calendar.errorConnection',
                'Calendar data could not be loaded. Please submit a manual request via the form below.');
        }

        // Update calendar widget
        const calendarContainer = document.getElementById('vhs-calendar-widget');
        if (calendarContainer) {
            const title = getTranslation('vhs.calendar.manualRequestTitle', 'Manual Request Required');
            const text = getTranslation('vhs.calendar.manualRequestText',
                'Please use the form below to request an appointment. I will get back to you.');

            calendarContainer.innerHTML = `
                <div class="vhs-calendar-fallback" style="padding: var(--space-xl); text-align: center; background: var(--glass-bg); border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
                    <i class='bx bx-calendar-edit' style="font-size: 3rem; margin-bottom: var(--space-md); color: var(--color-primary);"></i>
                    <p style="margin-bottom: var(--space-sm); font-weight: var(--font-weight-semibold);">${title}</p>
                    <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${text}</p>
                </div>
            `;
        }

        // Convert date select to date input for manual entry
        const dateSelect = document.getElementById('booking-preferred-date');
        if (dateSelect) {
            const dateInput = document.createElement('input');
            dateInput.type = 'date';
            dateInput.id = 'booking-preferred-date';
            dateInput.name = 'preferredDate';
            dateInput.required = true;
            // Set min date to today
            const today = new Date();
            dateInput.min = today.toISOString().split('T')[0];
            // Set max date to 3 months from now
            const maxDate = new Date();
            maxDate.setMonth(maxDate.getMonth() + 3);
            dateInput.max = maxDate.toISOString().split('T')[0];

            dateSelect.parentNode.replaceChild(dateInput, dateSelect);
        }
    };

    /**
     * Load calendar events from Google Calendar iCal feed
     *
     * IMPORTANT: Google Calendar iCal feeds don't support CORS from browsers.
     * We must use a CORS proxy to fetch the calendar data.
     */
    const loadCalendarEvents = async () => {
        try {
            // Use CORS proxy immediately - Google Calendar doesn't support direct browser access
            // Using allorigins.win as a CORS proxy
            // TODO: Replace with your own Cloudflare Worker or backend proxy for production
            // Use configured proxy or fallback to allorigins (public proxy)
            // Note: The 'api' endpoint logic in config.js is prepared for your own Cloudflare worker.
            // If you haven't set up 'api.fabiseitz.de' yet, this might fail unless you create it or change config.js.
            // For now, we will prefer the helper IF it is in Beta mode (testing), but fallback to AllOrigins for Prod to ensure stability until you deploy the prod worker.
            // Actually, user requested "Use beta... fallback normal".
            // Normal was AllOrigins.
            // So: logic below tries SITE_CONFIG endpoint if we are in Beta, but if that fails? No, we can't easily failover on fetch.
            // We will assume if user follows instructions, they set up the worker.

            // However, to be safe during transition:
            // If on Beta/Local, use SITE_CONFIG.endpoints.calendarProxy (which points to api/beta.api)
            // If on Prod, use SITE_CONFIG... wait, if Prod worker isn't set up yet, site breaks.
            // Use fallback to AllOrigins for now if SITE_CONFIG isn't present or we want to force legacy.

            const getProxyUrl = () => {
                if (window.SITE_CONFIG && window.SITE_CONFIG.isBeta) {
                    return window.SITE_CONFIG.endpoints.calendarProxy;
                }
                // For Production, until you confirm 'api.fabiseitz.de' is live, we stick to AllOrigins?
                // User asked "Mach ein CNAME...". They are setting it up.
                // But "Fallback always to how it was".
                // "How it was" = AllOrigins.
                // So: Prod -> AllOrigins. Beta -> Beta Worker.
                return 'https://api.allorigins.win/raw?url=';
            };

            const CORS_PROXY = getProxyUrl();
            const proxiedUrl = CORS_PROXY + encodeURIComponent(CALENDAR_ICAL_URL);

            console.log('Fetching calendar via CORS proxy...');

            // Create abort controller for timeout (fallback for browsers without AbortSignal.timeout)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            let response;
            try {
                response = await fetch(proxiedUrl, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'text/calendar, text/plain, */*'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error('Error fetching calendar via proxy:', fetchError);

                // Check if it's a timeout/abort
                if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
                    throw new Error('CORS_ERROR: Calendar fetch timed out. Please try again later or contact directly.');
                }

                // Check if it's a network error
                if (fetchError.message.includes('Failed to fetch') ||
                    fetchError.message.includes('NetworkError') ||
                    fetchError.message.includes('CORS')) {
                    throw new Error('CORS_ERROR: Network error. Calendar proxy may be unavailable. Please contact directly for appointments.');
                }

                throw new Error('CORS_ERROR: Calendar requires backend proxy. Please contact directly for appointments.');
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
            }

            const icalText = await response.text();
            calendarEvents = parseICal(icalText);

            // Filter for VHS availability slots
            availableSlots = calculateAvailableSlots(calendarEvents);

            // Render calendar widget
            renderCalendarWidget();

            // Update form fields
            updateFormFields();
        } catch (error) {
            console.error('Error loading calendar:', error);
            // Show fallback message for all errors
            showFallbackMessage();
        }
    };

    /**
     * Parse iCal format text into event objects
     */
    const parseICal = (icalText) => {
        const events = [];
        const lines = icalText.split('\n');
        let currentEvent = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT' && currentEvent) {
                // If DTSTART exists but DTEND missing, infer end
                if (currentEvent.start && !currentEvent.end) {
                    // Check if it was a full-day event (start is midnight)
                    const isMidnight = currentEvent.start.getHours() === 0 && currentEvent.start.getMinutes() === 0;

                    const endDate = new Date(currentEvent.start);
                    if (isMidnight) {
                        // Assume 1 day duration for full-day events
                        endDate.setDate(endDate.getDate() + 1);
                    } else {
                        // Assume 1 hour for timed events
                        endDate.setHours(endDate.getHours() + 1);
                    }
                    currentEvent.end = endDate;
                }

                if (currentEvent.start && currentEvent.end) {
                    events.push(currentEvent);
                }
                currentEvent = null;
            } else if (currentEvent) {
                // ONLY parse start and end times - ignore all other fields (summary, description, etc.)
                // This ensures no sensitive data (event titles, descriptions) can be displayed
                if (line.startsWith('DTSTART')) {
                    currentEvent.start = parseICalDate(line);
                } else if (line.startsWith('DTEND')) {
                    currentEvent.end = parseICalDate(line);
                }
                // Explicitly ignore SUMMARY, DESCRIPTION, LOCATION, and all other fields
                // We only need start/end times to calculate availability
            }
        }

        console.log('VHS Calendar: Loaded ' + events.length + ' events.');
        return events;
    };

    /**
     * Parse iCal date format (YYYYMMDDTHHmmss or YYYYMMDD)
     * Supports UTC (Z suffix)
     */
    const parseICalDate = (line) => {
        const dateStr = line.split(':')[1] || line.split(';')[0].split(':')[1];
        if (!dateStr) return null;

        // Clean string (remove \r)
        const cleanDateStr = dateStr.replace('\r', '');

        // Handle timezone and format
        let date;
        if (cleanDateStr.includes('T')) {
            // Has time: YYYYMMDDTHHmmss[Z]
            // Check for UTC 'Z'
            const isUTC = cleanDateStr.endsWith('Z');
            const raw = cleanDateStr.replace('Z', '');

            const datePart = raw.substring(0, 8);
            const timePart = raw.substring(9, 15);

            if (isUTC) {
                date = new Date(Date.UTC(
                    datePart.substring(0, 4),
                    parseInt(datePart.substring(4, 6)) - 1,
                    datePart.substring(6, 8),
                    timePart.substring(0, 2),
                    timePart.substring(2, 4),
                    timePart.substring(4, 6)
                ));
            } else {
                date = new Date(
                    datePart.substring(0, 4),
                    parseInt(datePart.substring(4, 6)) - 1,
                    datePart.substring(6, 8),
                    timePart.substring(0, 2),
                    timePart.substring(2, 4),
                    timePart.substring(4, 6)
                );
            }
        } else {
            // Date only: YYYYMMDD
            date = new Date(
                cleanDateStr.substring(0, 4),
                parseInt(cleanDateStr.substring(4, 6)) - 1,
                cleanDateStr.substring(6, 8)
            );
        }

        return date;
    };

    /**
     * Calculate available slots based on VHS availability and existing events
     */
    const calculateAvailableSlots = (events) => {
        const slots = [];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 60); // Next 60 days

        // Generate available slots
        for (let date = new Date(today); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.getDay();

            let availability;
            if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                // Mon-Thu
                availability = VHS_AVAILABILITY.weekdays;
            } else if (dayOfWeek === 5) {
                // Friday
                availability = VHS_AVAILABILITY.friday;
            } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                // Weekend
                availability = VHS_AVAILABILITY.weekend;
            } else {
                continue; // Skip other days
            }

            // Parse base window start/end
            const [baseStartHour, baseStartMin] = availability.start.split(':').map(Number);
            const [baseEndHour, baseEndMin] = availability.end.split(':').map(Number);

            const windowStart = new Date(date);
            windowStart.setHours(baseStartHour, baseStartMin, 0, 0);

            const windowEnd = new Date(date);
            windowEnd.setHours(baseEndHour, baseEndMin, 0, 0);

            // Generate 45-minute slots within the window
            let currentSlotStart = new Date(windowStart);
            const slotDuration = 45 * 60 * 1000; // 45 minutes in ms

            while (currentSlotStart.getTime() + slotDuration <= windowEnd.getTime()) {
                const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDuration);

                // Check if slot overlaps with ANY busy event
                const isBlocked = events.some(event => {
                    if (!event.start || !event.end) return false;
                    const eventStart = new Date(event.start);
                    const eventEnd = new Date(event.end);

                    // Specific fix for multi-day events:
                    // Check intersection: (SlotStart < EventEnd) && (SlotEnd > EventStart)
                    return (currentSlotStart < eventEnd && currentSlotEnd > eventStart);
                });

                if (!isBlocked) {
                    // Format time string HH:MM
                    const formatTime = (d) => {
                        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    };

                    slots.push({
                        date: new Date(date),
                        start: formatTime(currentSlotStart),
                        end: formatTime(currentSlotEnd),
                        available: true
                    });
                }

                // Move to next slot
                currentSlotStart = new Date(currentSlotStart.getTime() + slotDuration);
            }
        }

        return slots;
    };

    /**
     * Render calendar widget
     */
    const renderCalendarWidget = () => {
        const widgetContainer = document.getElementById('vhs-calendar-widget');
        if (!widgetContainer) return;

        // Group slots by date
        const slotsByDate = new Map();
        availableSlots.forEach(slot => {
            const dateKey = slot.date.toISOString().split('T')[0];
            if (!slotsByDate.has(dateKey)) {
                slotsByDate.set(dateKey, []);
            }
            slotsByDate.get(dateKey).push(slot);
        });

        // Create calendar HTML
        let html = '<div class="vhs-calendar-grid">';

        // Show next 30 days
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30);

        for (let date = new Date(today); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dateKey = date.toISOString().split('T')[0];
            const slots = slotsByDate.get(dateKey) || [];
            const isAvailable = slots.length > 0;

            const dayName = date.toLocaleDateString(window.i18n?.currentLang || 'de-DE', { weekday: 'short' });
            const dayNumber = date.getDate();
            const month = date.toLocaleDateString(window.i18n?.currentLang || 'de-DE', { month: 'short' });

            html += `
                <div class="vhs-calendar-day ${isAvailable ? 'available' : 'unavailable'}" data-date="${dateKey}">
                    <div class="vhs-calendar-day-header">
                        <span class="vhs-calendar-day-name">${dayName}</span>
                        <span class="vhs-calendar-day-number">${dayNumber}</span>
                    </div>
                    <div class="vhs-calendar-day-month">${month}</div>
                    ${isAvailable ? '<div class="vhs-calendar-day-status available">Verfügbar</div>' : '<div class="vhs-calendar-day-status unavailable">Nicht verfügbar</div>'}
                </div>
            `;
        }

        html += '</div>';
        widgetContainer.innerHTML = html;

        // Add click listeners to available days
        widgetContainer.querySelectorAll('.vhs-calendar-day.available').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const date = dayEl.getAttribute('data-date');
                const dateSelect = document.getElementById('booking-preferred-date');
                const formSection = document.getElementById('vhs-booking-form');

                if (dateSelect && formSection) {
                    dateSelect.value = date;
                    // Trigger change event manually to update time options
                    dateSelect.dispatchEvent(new Event('change'));

                    // Scroll to form
                    formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Highlight the date input briefly
                    dateSelect.classList.add('highlight-input');
                    setTimeout(() => dateSelect.classList.remove('highlight-input'), 2000);
                }
            });
        });
    };

    /**
     * Update form fields based on available slots
     */
    const updateFormFields = () => {
        const dateSelect = document.getElementById('booking-preferred-date');
        const timeSelect = document.getElementById('booking-preferred-time');

        if (!dateSelect || !timeSelect) return;

        // Clear and populate Date Select
        // Save current selection if valid
        const currentValue = dateSelect.value;
        dateSelect.innerHTML = '<option value="" disabled selected data-i18n="vhs.booking.form.dateSelect">Bitte Datum wählen...</option>';

        // Get unique available dates
        const uniqueDates = [...new Set(availableSlots.map(slot => slot.date.toISOString().split('T')[0]))];

        uniqueDates.sort().forEach(dateStr => {
            const dateObj = new Date(dateStr);
            const dateLabel = dateObj.toLocaleDateString(window.i18n?.currentLang || 'de-DE', {
                weekday: 'long',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            const option = document.createElement('option');
            option.value = dateStr;
            option.textContent = dateLabel;
            dateSelect.appendChild(option);
        });

        // Restore selection if still available
        if (uniqueDates.includes(currentValue)) {
            dateSelect.value = currentValue;
        }

        // Update time options on change
        dateSelect.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            updateTimeOptions(selectedDate, timeSelect);
        });

        // Re-apply translations for the placeholder
        if (window.i18n && window.i18n.applyTranslations) {
            window.i18n.applyTranslations();
        }
    };

    /**
     * Update time select options based on selected date
     */
    const updateTimeOptions = (selectedDate, timeSelect) => {
        // Clear existing options except the first one
        while (timeSelect.options.length > 1) {
            timeSelect.remove(1);
        }

        // Find available slots for selected date
        const slots = availableSlots.filter(slot =>
            slot.date.toISOString().split('T')[0] === selectedDate
        );

        if (slots.length === 0) {
            // No slots available, disable time select
            timeSelect.disabled = true;
            return;
        }

        timeSelect.disabled = false;

        // Add time options based on availability
        slots.forEach(slot => {
            const option = document.createElement('option');
            option.value = `${slot.start}-${slot.end}`;
            option.textContent = `${slot.start} - ${slot.end} Uhr`;
            timeSelect.appendChild(option);
        });
    };

    /**
     * Show calendar error message
     */
    const showCalendarError = (customMessage = null) => {
        const widgetContainer = document.getElementById('vhs-calendar-widget');
        if (widgetContainer) {
            const message = customMessage || (window.i18n?.t('vhs.calendar.errorConnection') || 'Keine Verbindung zum Kalender. Bitte stellen Sie eine manuelle Anfrage.');
            widgetContainer.innerHTML = `
                <div class="vhs-calendar-error">
                    <i class='bx bx-error-circle'></i>
                    <p>${customMessage ? message : '<span data-i18n="vhs.calendar.errorConnection">Keine Verbindung zum Kalender. Bitte stellen Sie eine manuelle Anfrage.</span>'}</p>
                </div>
            `;
            if (window.i18n) {
                window.i18n.applyTranslations();
            }
        }
    };

    /**
     * Setup form filters
     */
    const setupFormFilters = () => { };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
