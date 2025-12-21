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

    // Google Calendar public iCal URL
    // IMPORTANT: This is a public calendar specifically for VHS appointments.
    // Format: https://calendar.google.com/calendar/ical/[CALENDAR_ID]/public/basic.ics
    const CALENDAR_ICAL_URL = 'https://calendar.google.com/calendar/ical/20f927fc2cd88c728aa298e86fd00973456fd5f875e0eed0cc4e98eb6260dbad%40group.calendar.google.com/public/basic.ics';

    let calendarEvents = [];
    let availableSlots = [];

    const init = () => {
        // Only initialize if calendar URL is configured
        if (!CALENDAR_ICAL_URL) {
            console.warn('VHS Calendar: No calendar URL configured');
            return;
        }

        // Skip calendar loading if running from file:// protocol (CORS restrictions)
        if (window.location.protocol === 'file:') {
            console.warn('VHS Calendar: Cannot load calendar from file:// protocol due to CORS restrictions.');
            return;
        }

        loadCalendarEvents();
        setupFormFilters();
    };

    /**
     * Load calendar events from Google Calendar iCal feed
     */
    const loadCalendarEvents = async () => {
        try {
            // Google Calendar iCal endpoints don't support CORS from browsers
            // Use a CORS proxy to fetch the calendar
            // Option 1: Use Cloudflare Worker (recommended for production)
            // Option 2: Use a public CORS proxy (fallback, not recommended for production)
            // Option 3: Fetch from backend server

            // Try using a CORS proxy
            // Using allorigins.win as a fallback CORS proxy
            const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
            const proxiedUrl = CORS_PROXY + encodeURIComponent(CALENDAR_ICAL_URL);

            let response;
            try {
                response = await fetch(proxiedUrl, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'text/calendar, text/plain, */*'
                    }
                });
            } catch (fetchError) {
                console.warn('Error fetching calendar via proxy:', fetchError);
                throw new Error('CORS_ERROR: Calendar requires backend proxy');
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

            // Show user-friendly error message for CORS issues
            if (error.message.includes('CORS_ERROR')) {
                const calendarContainer = document.getElementById('vhs-calendar-widget');
                if (calendarContainer) {
                    calendarContainer.innerHTML = `
                        <div class="vhs-calendar-error" style="padding: var(--space-lg); text-align: center; color: var(--color-text-secondary);">
                            <i class='bx bx-calendar-x' style="font-size: 3rem; margin-bottom: var(--space-md); color: var(--color-primary);"></i>
                            <p style="margin-bottom: var(--space-sm);"><strong>Kalender kann nicht geladen werden</strong></p>
                            <p style="font-size: var(--font-size-sm);">Der Google Calendar kann aufgrund von CORS-Beschränkungen nicht direkt vom Browser geladen werden. Bitte kontaktieren Sie mich direkt für Terminanfragen.</p>
                        </div>
                    `;
                }
            } else {
                // Show fallback message for other errors
                showCalendarError();
            }
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

        return events;
    };

    /**
     * Parse iCal date format (YYYYMMDDTHHmmss or YYYYMMDD)
     */
    const parseICalDate = (line) => {
        const dateStr = line.split(':')[1] || line.split(';')[0].split(':')[1];
        if (!dateStr) return null;

        // Handle timezone and format
        let date;
        if (dateStr.includes('T')) {
            // Has time: YYYYMMDDTHHmmss
            const datePart = dateStr.substring(0, 8);
            const timePart = dateStr.substring(9, 15);
            date = new Date(
                datePart.substring(0, 4),
                parseInt(datePart.substring(4, 6)) - 1,
                datePart.substring(6, 8),
                timePart.substring(0, 2),
                timePart.substring(2, 4),
                timePart.substring(4, 6)
            );
        } else {
            // Date only: YYYYMMDD
            date = new Date(
                dateStr.substring(0, 4),
                parseInt(dateStr.substring(4, 6)) - 1,
                dateStr.substring(6, 8)
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

        // Create a map of busy times
        // IMPORTANT: We only use start/end times - no event details (summary, description, etc.) are used
        const busyTimes = new Map();
        events.forEach(event => {
            // Only process events that have valid start and end times
            if (!event.start || !event.end) return;

            const start = new Date(event.start);
            const end = new Date(event.end);

            // Skip invalid dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

            const dateKey = start.toISOString().split('T')[0];

            if (!busyTimes.has(dateKey)) {
                busyTimes.set(dateKey, []);
            }
            // Only store start/end times - no event details
            busyTimes.get(dateKey).push({ start, end });
        });

        // Generate available slots
        for (let date = new Date(today); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.getDay();
            const dateKey = date.toISOString().split('T')[0];

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

            // Check if slot is available (not in busy times)
            const busy = busyTimes.get(dateKey) || [];
            const slotStart = new Date(date);
            const [startHour, startMin] = availability.start.split(':').map(Number);
            slotStart.setHours(startHour, startMin, 0, 0);

            const slotEnd = new Date(date);
            const [endHour, endMin] = availability.end.split(':').map(Number);
            slotEnd.setHours(endHour, endMin, 0, 0);

            // Check if slot overlaps with busy times
            const isAvailable = !busy.some(busySlot => {
                return (slotStart < busySlot.end && slotEnd > busySlot.start);
            });

            if (isAvailable) {
                slots.push({
                    date: new Date(date),
                    start: availability.start,
                    end: availability.end,
                    available: true
                });
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
    };

    /**
     * Update form fields based on available slots
     */
    const updateFormFields = () => {
        const dateInput = document.getElementById('booking-preferred-date');
        const timeSelect = document.getElementById('booking-preferred-time');

        if (!dateInput || !timeSelect) return;

        // Set min date to today
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);

        // Update time options based on selected date
        dateInput.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            updateTimeOptions(selectedDate, timeSelect);
        });
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
            const message = customMessage || (window.i18n?.t('vhs.calendar.error') || 'Kalender konnte nicht geladen werden. Bitte kontaktieren Sie mich direkt.');
            widgetContainer.innerHTML = `
                <div class="vhs-calendar-error">
                    <i class='bx bx-error-circle'></i>
                    <p>${customMessage ? message : '<span data-i18n="vhs.calendar.error">Kalender konnte nicht geladen werden. Bitte kontaktieren Sie mich direkt.</span>'}</p>
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
    const setupFormFilters = () => {
        const dateInput = document.getElementById('booking-preferred-date');
        if (!dateInput) return;

        // Only allow dates that have available slots
        dateInput.addEventListener('input', (e) => {
            const selectedDate = e.target.value;
            const hasSlots = availableSlots.some(slot =>
                slot.date.toISOString().split('T')[0] === selectedDate
            );

            if (!hasSlots && selectedDate) {
                e.target.setCustomValidity(
                    window.i18n?.t('vhs.calendar.dateNotAvailable') ||
                    'Dieses Datum ist nicht verfügbar. Bitte wählen Sie ein anderes Datum.'
                );
            } else {
                e.target.setCustomValidity('');
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
