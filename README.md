# Hotel Wolkenstille – „Ein Tag im Haus“

Demo-Website für ein **fiktives** Boutique-Hotel in den Alpen. Die Seite erzählt einen Tag im Haus von 06:00 bis 23:00 Uhr als Scroll-Geschichte; eine Buchungsleiste bleibt dabei immer erreichbar.

- **Live:** https://alper3019-ux.github.io/hotel-ein-tag-im-haus/
- **Repo:** https://github.com/alper3019-ux/hotel-ein-tag-im-haus

> **Fiktion, klar gekennzeichnet.** „Hotel Wolkenstille“ gibt es nicht (Namensprüfung per Websuche am 09.10.2026 ohne Treffer). Preise, Größen, Adressen, Öffnungszeiten, Routenwerte und Personennamen sind Platzhalter in eckigen Klammern oder ausdrücklich als Beispiel markiert. Es gibt **keine** Auszeichnungen, Sterne, Bewertungen oder Gästestimmen. Fotos sind Symbolbilder realer, nicht verbundener Orte.

## Was gebaut wurde

| Bereich | Umsetzung |
|---|---|
| Hero | Foto (Chiemgauer Alpen, Hoch-/Querformat), H1 mit Zeilen-Intro (nur ≥ 901 px), Uhrzeit-Chips als Sprungmarken, Hinweis „Fiktive Marke · Demo“ |
| Buchung | Anreise/Abreise/Erwachsene/Kinder mit echter Validierung (Datum in der Vergangenheit, Abreise vor Anreise, > 30 Nächte). Ergebnis ist eine **ehrliche Demo-Meldung** – keine Verfügbarkeit, keine Reservierung |
| Dock | Erscheint nach dem Hero (IntersectionObserver), öffnet dieselbe Maske in einem `<dialog>` |
| **Ein Tag im Haus** | ScrollTrigger-Pin mit Scrub, 6 Stationen (06/08/12/17/20/23 Uhr). three.js-Szene prozedural: fBm-Gelände mit See, ~1 100 instanzierte Bäume, Hotel aus Grundkörpern, Sonne nach Uhrzeit (Höhe/Azimut), Preetham-Himmel, Nachtkuppel mit Sternen und Mond, Fenstergruppen (Restaurant, Zimmer, Dachsuite, Spa) leuchten nach Uhrzeit. Render-on-Demand, pausiert außerhalb des Viewports |
| Zimmer | 3 Karten → Detaildialog mit View-Transition-Morph (Fallback ohne API) |
| Kulinarik, Spa | Beispielmenü, Parallaxe-Bilder |
| Umgebung | Eigene SVG-Karte, 3 Beispielrouten (Werte erfunden, nicht zur Navigation) |
| Angebote | 3 Pakete mit Platzhalterpreisen; Hinweis, dass keine Buchungsengine angebunden ist |
| Anfrage | Demo-Formular, sendet nichts |
| Rechtliches | Impressum (§ 5 DDG, Platzhalter), Datenschutz (keine Cookies, kein Tracking, keine Drittanbieter), Bildrechte (automatisch generiert), 404 |
| Barrierefreiheit | `prefers-reduced-motion`: kein Lenis, kein Pin, keine 3D-Szene, Stationen als Raster. Ohne WebGL bleibt ein CSS-Himmelsverlauf. Skip-Link, Fokusstile, Dialoge mit `<dialog>` |

**Stack:** Vite 8, three.js r186 (lazy, eigener Chunk), GSAP 3.15 (ScrollTrigger, SplitText), Lenis 1.3, Fraunces + Inter selbst gehostet (Fontsource, OFL), sharp für AVIF/WebP. Keine externen Requests.

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:5173/hotel-ein-tag-im-haus/
npm run photos       # Originale aus ../photo-orig/k2 → public/photos (AVIF + WebP + manifest.json)
npm run build
BASE=/hotel-ein-tag-im-haus PORT=4180 node scripts/serve-dist.mjs dist
node scripts/audit.mjs http://localhost:4180/hotel-ein-tag-im-haus/ audit 3
URL=http://localhost:4180/hotel-ein-tag-im-haus/ OUT=screens node scripts/screenshots.mjs all
bash scripts/deploy-gh-pages.sh   # Build + normaler Push auf gh-pages (kein Actions-Workflow)
```

`.env` setzt `VITE_BASE` und `VITE_SITE_URL` (Canonical, Sitemap, OG).

## Messungen

Lighthouse 13 (Median aus 3 Läufen, Chrome headless mit SwiftShader auf einer geteilten Linux-Box – die Performance-Werte schwanken deutlich zwischen Läufen) und axe-core 4 (WCAG 2.0/2.1/2.2 A+AA + Best Practices, nach Durchscrollen).

<!--MESSUNGEN-->

## Recherche und Quellen (alle selbst geöffnet)

**Referenzen (Awwwards, abgerufen 09.10.2026)**
- Tengile Malamala Collection – Site of the Day, Score 7,22; DashDigital + Ingamana; Tags u. a. Hotel/Restaurant, Luxury, Storytelling; Elemente u. a. Timeline, Preloader, Gallery. https://www.awwwards.com/sites/tengile-malamala-collection
- White Desert – Site of the Day, Score 7,31; Malvah, Geoff Dawes, Usudo; Tags u. a. Hotel/Restaurant, Luxury, Photo & Video, GSAP, Next.js. **Korrektur zum Konzeptbericht:** Auf der Awwwards-Seite ist *kein* WebGL-Tag gelistet; der Bericht hatte WebGL genannt. https://www.awwwards.com/sites/white-desert
- Awwwards-Kategorie Hotel/Restaurant (Überblick, u. a. alpine Häuser). https://www.awwwards.com/websites/hotel-restaurant/

**Markt (für die Argumentation „Direktbuchung sichtbar halten“)**
- SiteMinder, „Hotel Booking Trends 2026“: Auswertung von > 130 Mio. Buchungen; Hotel-Websites mit dem höchsten Wert pro Buchung (516 US$); durchschnittliche Vorlaufzeit 32,15 Tage; Stornoquote 19,15 %. https://www.siteminder.com/news/siteminder-hotel-booking-trends-2026/

**Technik**
- GSAP ScrollTrigger (Pin, Scrub, `anticipatePin`, Reihenfolge, `invalidateOnRefresh`): https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- GSAP Standard License (kommerziell kostenlos inkl. SplitText): https://gsap.com/standard-license
- Codrops, „How to Build Cinematic 3D Scroll Experiences with GSAP“ (19.11.2025) – Scroll-Timeline steuert Kamerawerte, Kapitel-Overlays: https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/
- three.js Docs (Sky-Addon, InstancedMesh, MeshStandardMaterial): https://threejs.org/docs/
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/de/docs/Web/CSS/@media/prefers-reduced-motion

**X (nur als Hinweise, jeweils auf Awwwards bestätigt)**
- @awwwards SOTD-Posts zu Tengile (x.com/awwwards/status/2106293817896796365) und White Desert (x.com/awwwards/status/2098321456887189647). Inhaltlich zitiert wird ausschließlich die Awwwards-Seite.

## Bildrechte

Alle Fotos: Wikimedia Commons, freie Lizenzen, kommerziell nutzbar. Bearbeitung: Zuschnitt, Verkleinerung, AVIF/WebP. Vollständige Tabelle mit Links: `bildrechte.html` bzw. `photos/sources.json` (inkl. SHA-1 von Original und Download).

| Motiv | Datei | Urheber | Lizenz |
|---|---|---|---|
| Hero | Hochries, Alpes del Chiemgau … DD 10-12 HDR | Diego Delso | CC BY-SA 4.0 |
| 06:00 | Lac de Montriond 06 | Krzysztof Golik | CC BY-SA 4.0 |
| 08:00 | Breakfast in Île d'Orléans 072 | Wilfredor | CC0 |
| 12:00 | Seiser Alm 11 | H. Zell | CC BY-SA 3.0 |
| 17:00 / Spa | Sauna … Amantaka | Basile Morin | CC BY-SA 4.0 |
| 20:00 | White tablecloth … Amantaka | Basile Morin | CC BY-SA 4.0 |
| 23:00 | Under stars and snows | Ummidnp | CC BY-SA 4.0 |
| Zirbenstube | Schönberg am Kamp … Gästezimmer | Isiwal | CC BY-SA 4.0 |
| Dachsuite | Canopy bed … Amantaka Suite | Basile Morin | CC BY-SA 4.0 |
| Bad-Suite | Bathtub of Khan Pool Suite … Amantaka | Basile Morin | CC BY-SA 4.0 |
| Kulinarik | Plat (noix de quasi de veau …) | Gzen92 | CC BY-SA 4.0 |
| Gipfeltour | Wetterspitzen (Stubaier Alpen) | Jörg Braukmann | CC0 |

Ein Foto (Hütte, Wolfgang Moroder) wurde bewusst **nicht** verwendet, weil der Urheber zusätzliche Bedingungen formuliert. Die Hochformat-Variante `hero-portrait-840` wurde aus der 1080-px-Variante abgeleitet; `npm run photos` erzeugt sie künftig direkt aus dem Original.

## Grenzen

- Keine echte Buchungsengine, keine Verfügbarkeiten, kein Versand von Formularen – absichtlich. Für den Echtbetrieb: Anbindung an die Buchungsengine des Hotels (Deep-Link mit Datum/Personen) und ein Formular-Backend mit Datenschutzprüfung.
- Impressum/Datenschutz sind Platzhalter und **keine Rechtsberatung**; vor Livegang juristisch prüfen.
- Die 3D-Szene ist stilisiert (Low-Poly), kein Abbild eines realen Hauses. Auf schwachen Geräten kostet sie GPU-Zeit; sie lädt erst bei Interaktion und rendert nur bei Änderungen.
- Datumsfelder nutzen native `input[type=date]`; das Anzeigeformat folgt der Browsersprache.
- Performance-Werte stammen aus einer Box mit Software-Rendering; echte Geräte liefern andere Zahlen.
