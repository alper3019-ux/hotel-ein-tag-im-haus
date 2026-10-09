# Changelog

Alle relevanten Änderungen an diesem Demo-Projekt. Datumsangaben in Europe/Berlin.

## [1.0.1] – 2026-10-09 (9.10.2026) – Verbesserungsrunde 1

### Geändert
- **WebGL-Prüfung erst beim Start der 3D-Szene** (`src/js/day-story.js`): `hasWebGL()` legte bisher schon beim Laden der Seite einen eigenen WebGL-Kontext an (Canvas + `getContext('webgl2'|'webgl')`). Die Prüfung läuft jetzt erst in `start()`, also wenn der Abschnitt „Ein Tag im Haus“ naht **und** jemand scrollt/interagiert – wie bereits in Konzept 1 (Residenz Felsgarten) und Konzept 3 (Mondgrund). Ohne WebGL bleibt wie bisher der CSS-Himmel.
  - Begründung: Lighthouse-Befund „Total Blocking Time“ (mobil Median 330 ms lokal / 401,5 ms live) – lange Tasks im Hauptthread während des Seitenaufbaus.
  - Quellen: https://web.dev/articles/tbt · https://web.dev/articles/optimize-long-tasks · https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
  - Funktionstest (Playwright, Desktop 1440×900): vor Interaktion keine 3D-Szene, nach Scroll zum Abschnitt `#tag.is-ready` = true, 0 Konsolenfehler (vorher und nachher identisch).

### Messung (Vorher = Build von main@815b92f, Nachher = dieser Stand; beide lokal mit `scripts/serve-dist.mjs`, Brotli)
Methode: Lighthouse 13.5.0 (Node-API, Headless Chrome, SwiftShader-WebGL), mobil = Standardprofil (simuliertes Throttling), Desktop = `desktop-config`; je 5 Läufe pro Formfaktor, Vorher/Nachher abwechselnd (A,B,B,A,…), Median. axe-core 4.14.0 (WCAG 2.0/2.1/2.2 A/AA + best-practice) nach Scroll durch die Seite; Konsolenfehler und HTTP-Fehler per Playwright. Rohdaten: `audit/2026-10-09/`. Hinweis: Der Messrechner war stark ausgelastet; daher die gepaarte Messung.

| | Perf | A11y | BP | SEO | LCP | CLS | TBT | axe | Konsolenfehler |
|---|---|---|---|---|---|---|---|---|---|
| mobil vorher | 83 | 100 | 100 | 100 | 3168 ms | 0,002 | 330 ms | 0 | 0 |
| mobil nachher | 90 | 100 | 100 | 100 | 3160 ms | 0,002 | 46 ms | 0 | 0 |
| Desktop vorher | 87 | 100 | 100 | 100 | 825 ms | 0 | 280 ms | 0 | 0 |
| Desktop nachher | 99 | 100 | 100 | 100 | 722 ms | 0 | 0 ms | 0 | 0 |

Speed Index mobil (nicht Teil der Freigabekriterien): 4158 → 4789 ms (Median).

## [1.0.0] – 2026-10-09

### Hinzugefügt
- Startseite „Hotel Wolkenstille“ (fiktive Marke) mit Hero-Foto, Uhrzeit-Chips und Buchungsleiste direkt unter dem Hero.
- Signatur-Abschnitt „Ein Tag im Haus“: per Scroll gepinnte Bühne, 06:00 → 23:00 Uhr in sechs Stationen. Prozedurale three.js-Talszene (Gelände, See, Bäume, Hotel), Himmel über das three.js-Addon `Sky`, Nacht mit Sternen und Mond, Fenster leuchten nach Uhrzeit. three.js wird erst nachgeladen, wenn der Abschnitt naht **und** die Seite benutzt wird.
- Uhr (5-Minuten-Schritte), Timeline mit Sprungmarken, Stationskarten mit Fotos und Querverweisen.
- Mitlaufende Buchungsleiste („Dock“) ab dem zweiten Bildschirm; öffnet dieselbe Buchungsmaske als Dialog.
- Zimmer mit Detaildialog (View-Transition, Fallback ohne), Kulinarik, Spa, illustrierte Karte mit drei Beispielrouten, Pakete, Anfrageformular.
- Ehrliche Demo-Formulare: echte Validierung, aber klare Meldung, dass nichts geprüft, reserviert, gesendet oder gespeichert wird.
- Impressum, Datenschutz, Bildrechte (Tabelle automatisch aus `photos/sources.json`), 404.
- Reduced-Motion-Fassung: keine 3D-Szene, kein Pin, Stationen als Kartenraster.
- Skripte: Fotoverarbeitung (AVIF/WebP), Audit (Lighthouse + axe), Screenshots, Deployment auf `gh-pages`.

### Performance-Korrekturen vor dem Release
- three.js-Chunk wurde anfangs schon beim Laden geholt (TBT ≈ 2 s) → Laden erst nach erster Interaktion.
- Layout-Shift durch Webfonts (CLS 0,33 Desktop) → Fonts und Hero-Bild per `preload`.
- Mobile-LCP (H1) wurde durch das Zeilen-Intro verzögert → Intro nur ab 901 px Breite; Hochformat-Hero zusätzlich in 840 px.
