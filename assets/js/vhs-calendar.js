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

    // Fixed blocked dates (month-day format, always blocked every year)
    const BLOCKED_DATES = [
        { month: 12, day: 24 }, // Christmas Eve
        { month: 12, day: 25 }, // Christmas Day
        { month: 12, day: 26 }, // 2nd Christmas Day
        { month: 12, day: 31 }, // New Year's Eve
        { month: 1, day: 1 },   // New Year's Day
        { month: 11, day: 26 }  // November 26
    ];

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

        // Wait for i18n to be ready before rendering
        if (window.i18n && window.i18n.translations && Object.keys(window.i18n.translations).length > 0) {
            loadCalendarEvents();
            setupFormFilters();
        } else {
            // Listener for subsequent init
            window.addEventListener('i18nInitialized', () => {
                loadCalendarEvents();
                setupFormFilters();
            });

            // Also wait for DOMContentLoaded slightly longer? No, i18nInitialized should fire.
            // If i18n fails, we might hang? i18n.js has error handling but might not fire success.
            // Fallback init after 2 seconds if i18n doesn't show up?
            setTimeout(() => {
                if (!calendarEvents.length && !window.vhsCalendarFallbackMode) {
                    console.warn('VHS Calendar: i18n timed out, forcing load');
                    loadCalendarEvents();
                    setupFormFilters();
                }
            }, 2000);
        }

        // Re-render when language changes
        window.addEventListener('languageChanged', () => {
            renderCalendarWidget();
            showFallbackMessageIfNeeded();
        });
    };

    // Helper to re-show fallback message if we are in fallback mode
    const showFallbackMessageIfNeeded = () => {
        if (window.vhsCalendarFallbackMode) {
            showFallbackMessage();
        }
    };

    /**
     * Show fallback mode - display calendar with warning when data can't be loaded
     */
    const showFallbackMessage = () => {
        const getTranslation = (key, fallback) => {
            return window.i18n?.t(key) || fallback;
        };

        // Set fallback mode flag
        window.vhsCalendarFallbackMode = true;

        // Update description text with warning
        const descriptionEl = document.querySelector('.vhs__calendar-description');
        if (descriptionEl) {
            descriptionEl.innerHTML = `
                <div class="vhs-calendar-warning" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: var(--border-radius-md); padding: var(--space-md); margin-bottom: var(--space-md);">
                    <i class='bx bx-error-circle' style="color: #f59e0b; margin-right: var(--space-xs);"></i>
                    <span>${getTranslation('vhs.calendar.fallbackWarning', 'Live calendar data unavailable. Displayed slots may not be accurate - I will confirm availability after your request.')}</span>
                </div>
            `;
        }

        // Generate slots assuming all dates are available (no events blocking)
        availableSlots = calculateAvailableSlots([]);

        // Render the calendar widget
        renderCalendarWidget();
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

            // Show loading state
            const widgetContainer = document.getElementById('vhs-calendar-widget');
            if (widgetContainer) {
                widgetContainer.innerHTML = `
                    <div style="text-align: center; padding: 4rem; color: var(--color-text-secondary);">
                        <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1rem;"></i>
                        <p>${window.i18n?.t('vhs.calendar.loading', 'Lade Kalenderdaten...')}</p>
                    </div>
                `;
            }

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
        endDate.setDate(endDate.getDate() + 28); // Next 4 weeks

        // Helper to check if a date is blocked
        const isBlockedDate = (date) => {
            const month = date.getMonth() + 1; // getMonth() is 0-indexed
            const day = date.getDate();
            return BLOCKED_DATES.some(blocked => blocked.month === month && blocked.day === day);
        };

        // Generate available slots
        for (let date = new Date(today); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Skip fixed blocked dates (holidays)
            if (isBlockedDate(date)) {
                continue;
            }

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
     * Render calendar widget with visual grid and multi-select
     */
    let currentWeeks = 2; // Default 2 weeks
    let currentFilter = { dayType: 'all', time: 'all' }; // Filter state

    const renderCalendarWidget = () => {
        const widgetContainer = document.getElementById('vhs-calendar-widget');
        if (!widgetContainer) return;

        // Selection state (preserved across re-renders)
        if (!window.vhsCalendarSelection) {
            window.vhsCalendarSelection = { primaryDate: null, alternativeDates: [] };
        }
        let { primaryDate, alternativeDates } = window.vhsCalendarSelection;

        // Group slots by date for availability lookup
        // FIX: Use local date string generation to match the grid generation loop
        const toLocalYMD = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const slotsByDate = new Map();
        availableSlots.forEach(slot => {
            const dateKey = toLocalYMD(slot.date);
            if (!slotsByDate.has(dateKey)) {
                slotsByDate.set(dateKey, []);
            }
            slotsByDate.get(dateKey).push(slot);
        });

        // Get translation helper
        const t = (key, fallback) => window.i18n?.t(key) || fallback;
        const locale = window.i18n?.currentLang === 'en' ? 'en-GB' : 'de-DE';

        // Calculate date range based on week toggle
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (currentWeeks * 7));

        // Build calendar HTML with controls
        let html = `
            <div class="vhs-calendar">
                <div class="vhs-calendar__header">
                    <h4 class="vhs-calendar__title">${t('vhs.calendar.selectDates', 'Select Appointment Dates')}</h4>
                    <p class="vhs-calendar__instructions">
                        ${t('vhs.calendar.instructions', 'Click to select your preferred date (dark). Click additional dates for alternatives (light). Gray dates are not available.')}
                    </p>
                </div>

                <!-- Week Toggle & Filters -->
                <div class="vhs-calendar__controls">
                    <div class="vhs-calendar__week-toggle">
                        <button type="button" class="vhs-calendar__btn ${currentWeeks === 2 ? 'vhs-calendar__btn--active' : ''}" data-weeks="2">
                            ${t('vhs.calendar.weeks2', '2 Weeks')}
                        </button>
                        <button type="button" class="vhs-calendar__btn ${currentWeeks === 4 ? 'vhs-calendar__btn--active' : ''}" data-weeks="4">
                            ${t('vhs.calendar.weeks4', '4 Weeks')}
                        </button>
                    </div>
                    <div class="vhs-calendar__filters">
                        <select id="vhs-filter-daytype" class="vhs-calendar__filter-select">
                            <option value="all" ${currentFilter.dayType === 'all' ? 'selected' : ''}>${t('vhs.calendar.filter.allDays', 'All days')}</option>
                            <option value="weekdays" ${currentFilter.dayType === 'weekdays' ? 'selected' : ''}>${t('vhs.calendar.filter.weekdays', 'Weekdays only')}</option>
                            <option value="weekend" ${currentFilter.dayType === 'weekend' ? 'selected' : ''}>${t('vhs.calendar.filter.weekend', 'Weekend only')}</option>
                        </select>
                        <select id="vhs-filter-time" class="vhs-calendar__filter-select">
                            <option value="all" ${currentFilter.time === 'all' ? 'selected' : ''}>${t('vhs.calendar.filter.allTimes', 'All times')}</option>
                            <option value="morning" ${currentFilter.time === 'morning' ? 'selected' : ''}>${t('vhs.calendar.filter.morning', 'Morning')}</option>
                            <option value="afternoon" ${currentFilter.time === 'afternoon' ? 'selected' : ''}>${t('vhs.calendar.filter.afternoon', 'Afternoon')}</option>
                            <option value="evening" ${currentFilter.time === 'evening' ? 'selected' : ''}>${t('vhs.calendar.filter.evening', 'Evening')}</option>
                        </select>
                    </div>
                </div>

                <div class="vhs-calendar__legend">
                    <span class="vhs-calendar__legend-item"><span class="vhs-calendar__legend-dot vhs-calendar__legend-dot--primary"></span>${t('vhs.calendar.primaryLabel', 'Preferred')}</span>
                    <span class="vhs-calendar__legend-item"><span class="vhs-calendar__legend-dot vhs-calendar__legend-dot--alternative"></span>${t('vhs.calendar.alternativeLabel', 'Alternative')}</span>
                    <span class="vhs-calendar__legend-item"><span class="vhs-calendar__legend-dot vhs-calendar__legend-dot--blocked"></span>${t('vhs.calendar.blockedLabel', 'Not available')}</span>
                </div>
                <div class="vhs-calendar__weekdays">
                    <span>${t('vhs.calendar.weekdays.mon', 'Mo')}</span>
                    <span>${t('vhs.calendar.weekdays.tue', 'Di')}</span>
                    <span>${t('vhs.calendar.weekdays.wed', 'Mi')}</span>
                    <span>${t('vhs.calendar.weekdays.thu', 'Do')}</span>
                    <span>${t('vhs.calendar.weekdays.fri', 'Fr')}</span>
                    <span>${t('vhs.calendar.weekdays.sat', 'Sa')}</span>
                    <span>${t('vhs.calendar.weekdays.sun', 'So')}</span>
                </div>
                <div class="vhs-calendar__grid">`;

        // Find the Monday of the week containing today
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);

        // Calculate number of days to show (add 1 extra week to fill grid)
        const totalDays = (currentWeeks + 1) * 7;

        // Generate days
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);

            // FIX: Use manual YYYY-MM-DD generation to match slotsByDate and avoid ISO/UTC shift
            const dateKey = toLocalYMD(date);

            const dow = date.getDay(); // 0=Sun, 1=Mon, ...

            const isPast = date < today;
            const isOutOfRange = date > endDate;
            const isAvailable = slotsByDate.has(dateKey) && slotsByDate.get(dateKey).length > 0;

            // Apply day type filter
            let isFilteredOut = false;
            if (currentFilter.dayType === 'weekdays' && (dow === 0 || dow === 6)) {
                isFilteredOut = true;
            } else if (currentFilter.dayType === 'weekend' && dow !== 0 && dow !== 6) {
                isFilteredOut = true;
            }

            const isBlocked = !isAvailable || isPast || isOutOfRange || isFilteredOut;

            const dayNumber = date.getDate();
            const isToday = date.toDateString() === today.toDateString();
            const month = date.toLocaleDateString(locale, { month: 'short' });
            const showMonth = dayNumber === 1 || i === 0;

            let classes = 'vhs-calendar__day';
            if (isBlocked) classes += ' vhs-calendar__day--blocked';
            if (isPast) classes += ' vhs-calendar__day--past';
            if (isToday) classes += ' vhs-calendar__day--today';
            if (isFilteredOut && !isPast) classes += ' vhs-calendar__day--filtered';
            if (primaryDate === dateKey) classes += ' vhs-calendar__day--primary';
            if (alternativeDates.includes(dateKey)) classes += ' vhs-calendar__day--alternative';

            html += `
                <div class="${classes}" data-date="${dateKey}" ${isBlocked ? '' : 'tabindex="0"'}>
                    <span class="vhs-calendar__day-number">${dayNumber}</span>
                    ${showMonth ? `<span class="vhs-calendar__day-month">${month}</span>` : ''}
                </div>`;
        }

        html += `
                </div>
                <div class="vhs-calendar__selection">
                    <div class="vhs-calendar__selection-primary">
                        <label>${t('vhs.calendar.selectedPrimary', 'Preferred date:')}</label>
                        <span id="vhs-primary-display">-</span>
                    </div>
                    <div class="vhs-calendar__selection-alternatives">
                        <label>${t('vhs.calendar.selectedAlternatives', 'Alternatives:')}</label>
                        <span id="vhs-alternatives-display">-</span>
                    </div>
                </div>
            </div>`;

        widgetContainer.innerHTML = html;

        // Add click handlers
        const grid = widgetContainer.querySelector('.vhs-calendar__grid');
        const primaryDisplay = document.getElementById('vhs-primary-display');
        const alternativesDisplay = document.getElementById('vhs-alternatives-display');

        // Helper function to parse date string YYYY-MM-DD as local date (not UTC)
        const parseLocalDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day); // month is 0-indexed
        };

        const updateDisplay = () => {
            if (primaryDate) {
                const d = parseLocalDate(primaryDate);
                primaryDisplay.textContent = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
            } else {
                primaryDisplay.textContent = '-';
            }

            if (alternativeDates.length > 0) {
                alternativesDisplay.textContent = alternativeDates.map(dateKey => {
                    const d = parseLocalDate(dateKey);
                    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
                }).join(', ');
            } else {
                alternativesDisplay.textContent = '-';
            }

            // Update hidden form fields
            const primaryInput = document.getElementById('booking-preferred-date');
            const alternativesInput = document.getElementById('booking-alternative-dates');
            if (primaryInput) primaryInput.value = primaryDate || '';
            if (alternativesInput) alternativesInput.value = alternativeDates.join(',');

            // Update booking form visible display
            const bookingHint = document.getElementById('booking-calendar-hint');
            const bookingSelectedDates = document.getElementById('booking-selected-dates');
            const bookingPrimaryDisplay = document.getElementById('booking-primary-display');
            const bookingAlternativesDisplay = document.getElementById('booking-alternatives-display');

            if (primaryDate) {
                // Hide hint, show selected dates
                if (bookingHint) bookingHint.style.display = 'none';
                if (bookingSelectedDates) bookingSelectedDates.style.display = 'block';

                // Update booking form displays
                if (bookingPrimaryDisplay) {
                    const d = parseLocalDate(primaryDate);
                    bookingPrimaryDisplay.textContent = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
                }
                if (bookingAlternativesDisplay) {
                    if (alternativeDates.length > 0) {
                        bookingAlternativesDisplay.textContent = alternativeDates.map(dateKey => {
                            const d = parseLocalDate(dateKey);
                            return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
                        }).join(', ');
                    } else {
                        bookingAlternativesDisplay.textContent = '-';
                    }
                }

                // NEW: Update time options if in specific mode
                const timeTypeSpecific = document.querySelector('input[name="timePreferenceType"][value="specific"]');
                const timeSelect = document.getElementById('booking-preferred-time');
                if (timeTypeSpecific && timeTypeSpecific.checked && timeSelect) {
                    updateTimeOptions(primaryDate, timeSelect);
                }
            } else {
                // Show hint, hide selected dates
                if (bookingHint) bookingHint.style.display = 'block';
                if (bookingSelectedDates) bookingSelectedDates.style.display = 'none';
            }
        };

        const updateDayClasses = () => {
            grid.querySelectorAll('.vhs-calendar__day').forEach(dayEl => {
                const dateKey = dayEl.getAttribute('data-date');
                dayEl.classList.remove('vhs-calendar__day--primary', 'vhs-calendar__day--alternative');
                if (dateKey === primaryDate) {
                    dayEl.classList.add('vhs-calendar__day--primary');
                } else if (alternativeDates.includes(dateKey)) {
                    dayEl.classList.add('vhs-calendar__day--alternative');
                }
            });
        };

        grid.querySelectorAll('.vhs-calendar__day:not(.vhs-calendar__day--blocked)').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const dateKey = dayEl.getAttribute('data-date');

                if (dateKey === primaryDate) {
                    // Clicking primary again deselects it
                    primaryDate = null;
                    window.vhsCalendarSelection.primaryDate = null;
                } else if (alternativeDates.includes(dateKey)) {
                    // Clicking alternative removes it
                    alternativeDates = alternativeDates.filter(d => d !== dateKey);
                    window.vhsCalendarSelection.alternativeDates = alternativeDates;
                } else if (!primaryDate) {
                    // No primary yet - set this as primary
                    primaryDate = dateKey;
                    window.vhsCalendarSelection.primaryDate = dateKey;
                } else {
                    // Add as alternative (max 3)
                    if (alternativeDates.length < 3) {
                        alternativeDates.push(dateKey);
                        window.vhsCalendarSelection.alternativeDates = alternativeDates;
                    }
                }

                updateDayClasses();
                updateDisplay();
            });

            // Keyboard accessibility
            dayEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dayEl.click();
                }
            });
        });

        // Week toggle event listeners
        widgetContainer.querySelectorAll('.vhs-calendar__btn[data-weeks]').forEach(btn => {
            btn.addEventListener('click', () => {
                const weeks = parseInt(btn.getAttribute('data-weeks'), 10);
                if (weeks !== currentWeeks) {
                    currentWeeks = weeks;
                    renderCalendarWidget(); // Re-render
                }
            });
        });

        // Filter event listeners
        const dayTypeFilter = document.getElementById('vhs-filter-daytype');
        const timeFilter = document.getElementById('vhs-filter-time');

        if (dayTypeFilter) {
            dayTypeFilter.addEventListener('change', () => {
                currentFilter.dayType = dayTypeFilter.value;
                renderCalendarWidget(); // Re-render
            });
        }

        if (timeFilter) {
            timeFilter.addEventListener('change', () => {
                currentFilter.time = timeFilter.value;
                renderCalendarWidget(); // Re-render
            });
        }

        // Update display on initial render
        updateDisplay();
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
    /**
     * Setup form filters
     */
    const setupFormFilters = () => {
        const timeSelect = document.getElementById('booking-preferred-time');
        const specificRadio = document.querySelector('input[name="timePreferenceType"][value="specific"]');
        const flexibleRadio = document.querySelector('input[name="timePreferenceType"][value="flexible"]');

        if (!timeSelect || !specificRadio || !flexibleRadio) return;

        const handleTypeChange = () => {
            if (specificRadio.checked) {
                // Switch to specific: populate with calculated slots
                const date = window.vhsCalendarSelection?.primaryDate;
                updateTimeOptions(date, timeSelect);
            } else {
                // Switch to flexible: restore static options
                timeSelect.innerHTML = '';
                timeSelect.disabled = false;

                const t = (key, def) => window.i18n?.t(key) || def;

                // Add default option
                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.textContent = t('vhs.booking.form.timeSelect', "Bitte wählen...");
                timeSelect.appendChild(defaultOpt);

                // Morning
                const morn = document.createElement('option');
                morn.value = "morning";
                morn.textContent = t('vhs.booking.form.timeMorning', "Vormittag (10:00 - 12:00)");
                timeSelect.appendChild(morn);

                // Afternoon
                const aft = document.createElement('option');
                aft.value = "afternoon";
                aft.textContent = t('vhs.booking.form.timeAfternoon', "Nachmittag (12:00 - 18:00)");
                timeSelect.appendChild(aft);

                // Evening
                const eve = document.createElement('option');
                eve.value = "evening";
                eve.textContent = t('vhs.booking.form.timeEvening', "Abend (18:00 - 21:00)");
                timeSelect.appendChild(eve);
            }
        };

        specificRadio.addEventListener('change', handleTypeChange);
        flexibleRadio.addEventListener('change', handleTypeChange);

        // Initial run
        handleTypeChange();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
