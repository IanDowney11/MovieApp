# KidFlicks

PWA for finding G and PG rated movies playing at Australian cinemas.

## Setup

1. Get a free TMDB API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
2. Open the app, tap the settings icon, paste your key

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Cinemas

Hoyts, Event Cinemas, Village Cinemas, Reading Cinemas. Toggle chains on/off in Settings.

## Notes

- Movie data (posters, descriptions) comes from TMDB filtered to AU G/PG certification
- Tapping a cinema button opens that chain's movie page where you pick date and location
- Works offline once loaded (service worker caches posters and API responses)
