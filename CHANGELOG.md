# Changelog

Alle relevanten Änderungen an diesem Demo-Projekt. Datumsangaben in Europe/Berlin.

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
