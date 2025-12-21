# Google Calendar CORS Issue - Documentation

## Problem

Google Calendar iCal-Feeds unterstützen **keine CORS-Header**, was bedeutet, dass Browser direkte JavaScript-Fetch-Requests zu Google Calendar blockieren.

### Fehlermeldung
```
Access to fetch at 'https://calendar.google.com/calendar/ical/...' from origin 'https://fabiseitz.de'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Warum passiert das?

1. **CORS (Cross-Origin Resource Sharing)** ist eine Sicherheitsmaßnahme
2. Google Calendar sendet keine `Access-Control-Allow-Origin` Header
3. Browser blockieren automatisch Cross-Origin-Requests ohne CORS-Header
4. Dies ist eine **Sicherheitsmaßnahme**, keine Fehlfunktion

## Aktuelle Lösung

### Implementiert: CORS-Proxy
- **Proxy-Service:** `api.allorigins.win`
- **Funktionsweise:** Proxy holt den iCal-Feed und fügt CORS-Header hinzu
- **Status:** Funktioniert, aber nicht ideal für Produktion

### Code-Implementierung
```javascript
// vhs-calendar.js verwendet sofort einen CORS-Proxy
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const proxiedUrl = CORS_PROXY + encodeURIComponent(CALENDAR_ICAL_URL);
```

## Probleme mit öffentlichen CORS-Proxies

1. **Zuverlässigkeit:** Öffentliche Proxies können ausfallen oder blockiert werden
2. **Performance:** Zusätzliche Latenz durch Proxy
3. **Sicherheit:** Dritte haben Zugriff auf den Request
4. **Rate Limits:** Öffentliche Proxies haben oft Rate Limits

## Empfohlene Lösungen für Produktion

### Option 1: Cloudflare Worker (Empfohlen) ⭐

**Vorteile:**
- Schnell und zuverlässig
- Kostenlos für moderate Nutzung
- Läuft auf Cloudflare's Edge-Netzwerk
- Volle Kontrolle über CORS-Header

**Implementierung:**
```javascript
// Cloudflare Worker Code
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const calendarUrl = 'https://calendar.google.com/calendar/ical/.../public/basic.ics'
  const response = await fetch(calendarUrl)
  const icalText = await response.text()

  return new Response(icalText, {
    headers: {
      'Content-Type': 'text/calendar',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
  })
}
```

**Verwendung im Frontend:**
```javascript
// In vhs-calendar.js ändern:
const CALENDAR_PROXY_URL = 'https://your-worker.your-subdomain.workers.dev/calendar';
```

### Option 2: Eigener Backend-Server

**Vorteile:**
- Volle Kontrolle
- Kann zusätzliche Features hinzufügen (Caching, Filterung, etc.)

**Beispiel (Node.js/Express):**
```javascript
app.get('/api/calendar', async (req, res) => {
  const calendarUrl = 'https://calendar.google.com/calendar/ical/.../public/basic.ics'
  const response = await fetch(calendarUrl)
  const icalText = await response.text()

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'text/calendar')
  res.send(icalText)
})
```

### Option 3: Google Calendar API (Komplexer)

**Vorteile:**
- Offizielle API
- Mehr Kontrolle über Daten

**Nachteile:**
- Erfordert OAuth-Authentifizierung
- Komplexere Implementierung
- API-Quoten

## Aktueller Status

✅ **Funktioniert:** CORS-Proxy wird verwendet
⚠️ **Verbesserungswürdig:** Für Produktion sollte ein eigener Proxy verwendet werden

## Nächste Schritte

1. **Kurzfristig:** Aktuelle Lösung beibehalten (funktioniert)
2. **Mittelfristig:** Cloudflare Worker implementieren
3. **Langfristig:** Eigener Backend-Service für erweiterte Features

## Fallback-Verhalten

Wenn der Kalender nicht geladen werden kann:
- Benutzerfreundliche Fehlermeldung wird angezeigt
- Buchungsformular funktioniert weiterhin
- Benutzer können direkt Kontakt aufnehmen

## Weitere Informationen

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Google Calendar API](https://developers.google.com/calendar/api)
