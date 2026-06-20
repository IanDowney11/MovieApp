import { store } from './store.js'
import { CINEMAS } from './cinemas.js'
import { getNowPlayingKidsMovies, getMovieDetails, getPosterUrl, searchAndEnrichFromTMDB } from './api.js'

// ---- STATE ----

const state = {
  view: 'home',
  settingsTab: 'hoyts',
  selectedDate: 'today',
  movies: [],
  loading: false,
  error: null,
  selectedMovie: null,
  movieDetail: null,
  detailLoading: false,
  sessions: null,
  sessionsLoading: false,
  hoytsCinemaList: null,
  hoytsCinemaListLoading: false,
  hoytsCinemaListError: false,
  villageCinemaList: null,
  villageCinemaListLoading: false,
  villageCinemaListError: false,
}

const app = document.getElementById('app')

// ---- UTILITIES ----

function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateLabel(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isoDate(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMoviePoster(movie, size = 'w342') {
  if (movie.poster_url) return movie.poster_url
  return getPosterUrl(movie.poster_path, size)
}

function getMovieSessionsFromHome(movie) {
  const sessions = []
  if (movie._hoytsSessions)   sessions.push(movie._hoytsSessions)
  if (movie._villageSessions) sessions.push(movie._villageSessions)
  return sessions.length ? sessions : null
}

// ---- ICONS ----

const ICON_SETTINGS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
const ICON_BACK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
const ICON_REFRESH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
const ICON_EXTERNAL = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
const ICON_TICKET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`

// ---- RENDER: HOME ----

function renderHome() {
  return `
    <header class="header">
      <h1 class="header-title">KidFlicks</h1>
      <div class="header-actions">
        <button class="icon-btn" id="refresh-btn" aria-label="Refresh">${ICON_REFRESH}</button>
        <button class="icon-btn" id="settings-btn" aria-label="Settings">${ICON_SETTINGS}</button>
      </div>
    </header>

    ${!store.hasAnyCinema() ? `
      <div class="location-prompt">
        Select your cinemas in
        <button class="text-link" id="open-settings-loc">Settings</button>
        to see what's on near you.
      </div>
    ` : ''}

    <div class="date-tabs">
      <button class="date-tab ${state.selectedDate === 'today' ? 'active' : ''}" data-date="today">
        Today <span class="date-sub">${dateLabel(0)}</span>
      </button>
      <button class="date-tab ${state.selectedDate === 'tomorrow' ? 'active' : ''}" data-date="tomorrow">
        Tomorrow <span class="date-sub">${dateLabel(1)}</span>
      </button>
    </div>
    ${renderMovieList()}
  `
}

function renderMovieList() {
  if (state.loading) {
    return `<div class="loading"><div class="spinner"></div><p>Finding kids movies...</p></div>`
  }
  if (state.error) {
    return `
      <div class="center-state">
        <div class="error-icon">!</div>
        <h3>Could not load movies</h3>
        <p class="muted">${esc(state.error)}</p>
        <button class="btn-secondary" id="retry-btn">Try again</button>
      </div>`
  }
  if (!state.movies.length) {
    return `
      <div class="center-state">
        <p>No kids movies found right now.</p>
        <p class="muted">Try refreshing — new movies are added regularly.</p>
        <button class="btn-secondary" id="retry-btn">Refresh</button>
      </div>`
  }

  const hasSessions = state.movies.some(m => m._hoytsSessions || m._villageSessions)
  const note = hasSessions
    ? `Showing sessions at your selected cinemas`
    : `Showing G &amp; PG rated movies &mdash; tap for session times`

  return `
    <p class="list-note">${note}</p>
    <div class="movie-grid">
      ${state.movies.map(m => renderMovieCard(m, getMovieSessionsFromHome(m))).join('')}
    </div>
  `
}

function renderMovieCard(movie, movieSessions) {
  const poster = getMoviePoster(movie, 'w342')

  let sessionsHtml = ''
  if (movieSessions && movieSessions.length > 0) {
    sessionsHtml = movieSessions.map(s => {
      const chain = CINEMAS.find(c => c.id === s.chain)
      if (!chain) return ''
      const allTimes = s.locations.flatMap(loc => loc.times)
      if (!allTimes.length) return ''
      const MAX = 4
      const shown = allTimes.slice(0, MAX)
      const extra = allTimes.length - MAX
      return `
        <div class="card-sessions">
          <span class="cinema-abbr-sm" style="background:${chain.color}">${esc(chain.abbr)}</span>
          <span class="card-times">
            ${shown.map(t => `<span class="card-time">${esc(t.time)}</span>`).join('')}
            ${extra > 0 ? `<span class="card-time-more">+${extra}</span>` : ''}
          </span>
        </div>`
    }).join('')
  }

  return `
    <button class="movie-card" data-id="${movie.id}" aria-label="${esc(movie.title)}">
      <div class="movie-poster">
        ${poster
          ? `<img src="${esc(poster)}" alt="" loading="lazy" />`
          : `<div class="poster-placeholder"><span>${esc(movie.title.charAt(0))}</span></div>`
        }
      </div>
      <div class="movie-info">
        <h3 class="movie-title">${esc(movie.title)}</h3>
        ${movie.release_date ? `<span class="movie-year">${movie.release_date.slice(0, 4)}</span>` : ''}
        ${sessionsHtml}
      </div>
    </button>
  `
}

// ---- RENDER: DETAIL ----

function renderDetail() {
  const movie = state.selectedMovie
  const detail = state.movieDetail
  const dateOffset = state.selectedDate === 'today' ? 0 : 1
  const dateText = dateLabel(dateOffset)

  const poster = getMoviePoster(movie, 'w500')
  const cert = detail?.au_certification || movie.au_certification || ''
  const runtime = detail?.runtime
    ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
    : ''
  const overview = detail?.overview || movie.overview || ''

  return `
    <div class="detail-view">
      <button class="back-btn" id="back-btn">${ICON_BACK} Back</button>

      <div class="detail-hero">
        ${poster
          ? `<img class="detail-poster" src="${esc(poster)}" alt="${esc(movie.title)}" />`
          : `<div class="detail-poster-ph"><span>${esc(movie.title.charAt(0))}</span></div>`
        }
        <div class="detail-fade"></div>
      </div>

      <div class="detail-body">
        <div class="detail-chips">
          ${cert ? `<span class="cert-badge">${esc(cert)}</span>` : ''}
          ${movie.release_date ? `<span class="chip">${movie.release_date.slice(0, 4)}</span>` : ''}
          ${state.detailLoading ? `<span class="chip muted">Loading...</span>`
            : runtime ? `<span class="chip">${runtime}</span>` : ''}
        </div>

        <h2 class="detail-title">${esc(movie.title)}</h2>
        ${overview ? `<p class="detail-overview">${esc(overview)}</p>` : ''}

        <div class="sessions-section">
          <h3 class="sessions-heading">Sessions &mdash; ${esc(dateText)}</h3>
          ${!store.hasAnyCinema()
            ? `<p class="muted small">Select your cinemas in <button class="text-link" id="go-settings-loc">Settings</button> to see session times.</p>`
            : renderSessionsBlock()
          }
        </div>
      </div>
    </div>
  `
}

function renderSessionsBlock() {
  if (state.sessionsLoading) {
    return `<div class="sessions-loading"><div class="spinner sm"></div><span>Looking up session times...</span></div>`
  }

  const sessions = state.sessions
  if (!sessions) {
    return `<p class="muted small">No session data available.</p>`
  }

  const hoytsSessions = sessions.hoyts || []
  const villageSessions = sessions.village || []

  if (!hoytsSessions.length && !villageSessions.length) {
    return `<p class="muted small">No sessions found at your selected cinemas for this day.</p>`
  }

  function renderGroup(loc, color, abbr, cinemaDisplayName) {
    return `
      <div class="session-group">
        <div class="session-cinema-name">
          <span class="cinema-abbr-sm" style="background:${color}">${abbr}</span>
          ${esc(cinemaDisplayName)}
        </div>
        <div class="session-times">
          ${loc.times.map(t => `
            <a href="${esc(t.bookingUrl)}" target="_blank" rel="noopener noreferrer" class="session-time-btn">
              ${ICON_TICKET}${esc(t.time)}
            </a>
          `).join('')}
        </div>
      </div>`
  }

  const hoytsHtml = hoytsSessions.map(loc => {
    const name = state.hoytsCinemaList?.find(c => c.id === loc.cinema)?.name || loc.cinema
    return renderGroup(loc, '#e8002d', 'H', name)
  }).join('')

  const villageHtml = villageSessions.map(loc =>
    renderGroup(loc, '#7b2d8b', 'V', loc.cinema)
  ).join('')

  return hoytsHtml + villageHtml
}

// ---- RENDER: SETTINGS ----

function cinemaPickerBody(list, loading, error, selectedIds, checkboxClass, retryId) {
  if (loading) {
    return `<div class="loading-sm"><div class="spinner sm"></div> Loading cinemas&hellip;</div>`
  }
  if (error || !list) {
    return `<p class="muted small">Could not load cinema list. <button class="text-link" id="${retryId}">Retry</button></p>`
  }
  if (!list.length) {
    return `<p class="muted small">No cinemas found.</p>`
  }
  return `
    <div class="toggle-list">
      ${list.map(c => `
        <label class="toggle-row" for="${checkboxClass}-${esc(c.id)}">
          <div class="toggle-label">
            <span>${esc(c.name)}</span>
            ${c.suburb ? `<span class="cinema-suburb muted">${esc(c.suburb)}</span>` : ''}
          </div>
          <div class="switch">
            <input type="checkbox" id="${checkboxClass}-${esc(c.id)}" class="${checkboxClass}"
              data-id="${esc(c.id)}" ${selectedIds.includes(String(c.id)) ? 'checked' : ''} />
            <span class="slider"></span>
          </div>
        </label>
      `).join('')}
    </div>`
}

function renderSettings() {
  const tab = state.settingsTab
  const HOYTS_COLOR = '#e8002d'
  const VILLAGE_COLOR = '#7b2d8b'

  let tabContent
  if (tab === 'hoyts') {
    tabContent = cinemaPickerBody(
      state.hoytsCinemaList, state.hoytsCinemaListLoading, state.hoytsCinemaListError,
      store.getHoytsCinemaIds(), 'hoyts-cinema-toggle', 'retry-hoyts-btn'
    )
  } else {
    tabContent = cinemaPickerBody(
      state.villageCinemaList, state.villageCinemaListLoading, state.villageCinemaListError,
      store.getVillageCinemaIds(), 'village-cinema-toggle', 'retry-village-btn'
    )
  }

  return `
    <div class="settings-view">
      <header class="header">
        <button class="icon-btn" id="settings-back-btn" aria-label="Back">${ICON_BACK}</button>
        <h1 class="header-title">My Cinemas</h1>
        <div class="header-spacer"></div>
      </header>

      <div class="chain-tabs">
        <button class="chain-tab ${tab === 'hoyts' ? 'active' : ''}"
          data-tab="hoyts" style="--cc:${HOYTS_COLOR}">
          <span class="chain-dot" style="background:${HOYTS_COLOR}"></span>
          Hoyts
        </button>
        <button class="chain-tab ${tab === 'village' ? 'active' : ''}"
          data-tab="village" style="--cc:${VILLAGE_COLOR}">
          <span class="chain-dot" style="background:${VILLAGE_COLOR}"></span>
          Village
        </button>
      </div>

      <div class="settings-body">
        ${tabContent}
      </div>
    </div>
  `
}

// ---- RENDER DISPATCH ----

function render() {
  if (state.view === 'settings') {
    app.innerHTML = renderSettings()
    attachSettingsListeners()
  } else if (state.view === 'detail' && state.selectedMovie) {
    app.innerHTML = renderDetail()
    attachDetailListeners()
  } else {
    app.innerHTML = renderHome()
    attachHomeListeners()
  }
}

// ---- EVENT LISTENERS ----

function openSettings() {
  state.view = 'settings'
  render()
  // Only load the active tab's list immediately; the other loads on tab switch
  if (state.settingsTab === 'hoyts' && !state.hoytsCinemaList && !state.hoytsCinemaListLoading) {
    loadHoytsCinemaList()
  } else if (state.settingsTab === 'village' && !state.villageCinemaList && !state.villageCinemaListLoading) {
    loadVillageCinemaList()
  }
}

function attachHomeListeners() {
  document.getElementById('settings-btn')?.addEventListener('click', openSettings)
  document.getElementById('open-settings-loc')?.addEventListener('click', openSettings)
  document.getElementById('refresh-btn')?.addEventListener('click', () => loadMovies())
  document.getElementById('retry-btn')?.addEventListener('click', () => loadMovies())

  document.querySelectorAll('.date-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (state.selectedDate === tab.dataset.date) return
      state.selectedDate = tab.dataset.date
      loadMovies()
    })
  })

  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id
      state.selectedMovie = state.movies.find(m => String(m.id) === String(id)) || null
      if (!state.selectedMovie) return
      state.view = 'detail'
      state.movieDetail = null
      state.detailLoading = true
      window.scrollTo(0, 0)

      const homeSessions = getMovieSessionsFromHome(state.selectedMovie)
      if (homeSessions) {
        const detail = { hoyts: [], village: [] }
        for (const s of homeSessions) {
          if (detail[s.chain] !== undefined) detail[s.chain].push(...s.locations)
        }
        state.sessions = detail
        state.sessionsLoading = false
      } else {
        state.sessions = null
        state.sessionsLoading = store.hasAnyCinema()
      }

      render()
      loadMovieDetail(state.selectedMovie.id)
      if (state.sessionsLoading) loadSessions(state.selectedMovie)
    })
  })
}

function attachDetailListeners() {
  document.getElementById('back-btn')?.addEventListener('click', () => {
    state.view = 'home'; window.scrollTo(0, 0); render()
  })
  document.getElementById('go-settings-loc')?.addEventListener('click', openSettings)
}

function attachSettingsListeners() {
  document.getElementById('settings-back-btn')?.addEventListener('click', () => {
    state.view = 'home'; render(); loadMovies()
  })
  document.getElementById('retry-hoyts-btn')?.addEventListener('click', () => loadHoytsCinemaList())
  document.getElementById('retry-village-btn')?.addEventListener('click', () => loadVillageCinemaList())

  document.querySelectorAll('.chain-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.settingsTab === btn.dataset.tab) return
      state.settingsTab = btn.dataset.tab
      render()
      // Load the newly-switched chain's list if not already loaded
      if (state.settingsTab === 'village' && !state.villageCinemaList && !state.villageCinemaListLoading) {
        loadVillageCinemaList()
      }
      if (state.settingsTab === 'hoyts' && !state.hoytsCinemaList && !state.hoytsCinemaListLoading) {
        loadHoytsCinemaList()
      }
    })
  })

  document.querySelectorAll('.hoyts-cinema-toggle').forEach(t => {
    t.addEventListener('change', () => store.toggleHoytsCinema(t.dataset.id))
  })
  document.querySelectorAll('.village-cinema-toggle').forEach(t => {
    t.addEventListener('change', () => store.toggleVillageCinema(t.dataset.id))
  })
}

// ---- DATA LOADING ----

const ALLOWED_RATINGS = new Set(['g', 'pg'])

async function loadMovies() {
  state.loading = true
  state.error = null
  state.movies = []
  if (state.view === 'home') render()

  try {
    const hoytsCinemaIds  = store.getHoytsCinemaIds()
    const villageCinemaIds = store.getVillageCinemaIds()

    if (!store.hasAnyCinema() || import.meta.env.DEV) {
      state.movies = await getNowPlayingKidsMovies()
    } else {
      const dateOffset = state.selectedDate === 'today' ? 0 : 1
      const date = isoDate(dateOffset)

      const params = new URLSearchParams({ date })
      if (hoytsCinemaIds.length)  params.set('hoytsCinemaIds',  hoytsCinemaIds.join(','))
      if (villageCinemaIds.length) params.set('villageCinemaIds', villageCinemaIds.join(','))

      const res = await fetch(`/api/sessions?${params}`)
      if (!res.ok) throw new Error('Could not load cinema sessions')
      const data = await res.json()

      // Merge by title across chains, filter to G/PG using chain-provided rating
      const titleMap = {}
      for (const m of (data.byMovie || [])) {
        const key = (m.name || '').toLowerCase().trim()
        if (!titleMap[key]) titleMap[key] = { name: m.name, rating: '', hoyts: null, village: null }
        if (m.chain === 'hoyts')   titleMap[key].hoyts   = m
        if (m.chain === 'village') titleMap[key].village  = m
        if (m.rating && !titleMap[key].rating) titleMap[key].rating = m.rating
      }

      const enriched = await Promise.all(
        Object.values(titleMap).map(async ({ name, rating, hoyts, village }) => {
          if (!ALLOWED_RATINGS.has(rating.toLowerCase())) return null

          const tmdb = await searchAndEnrichFromTMDB(name)
          const base = tmdb || {
            id: village?.hoCode || hoyts?.vistaId || name,
            title: name,
            poster_path: null,
            poster_url: village?.posterUrl || null,
            overview: '',
            release_date: '',
            au_certification: rating,
          }

          return { ...base, _hoytsSessions: hoyts || null, _villageSessions: village || null }
        })
      )
      state.movies = enriched.filter(Boolean)
    }

    state.loading = false
    state.error = null
  } catch (err) {
    state.loading = false
    state.error = err.message || 'Failed to load movies.'
  }

  if (state.view === 'home') render()
}

async function loadHoytsCinemaList() {
  if (state.hoytsCinemaListLoading) return
  state.hoytsCinemaListLoading = true
  state.hoytsCinemaListError = false
  if (state.view === 'settings') render()
  try {
    const res = await fetch('/api/cinemas')
    if (!res.ok) throw new Error()
    const data = await res.json()
    state.hoytsCinemaList = data.cinemas || []
  } catch {
    state.hoytsCinemaListError = true
    state.hoytsCinemaList = null
  }
  state.hoytsCinemaListLoading = false
  if (state.view === 'settings') render()
}

async function loadVillageCinemaList() {
  if (state.villageCinemaListLoading) return
  state.villageCinemaListLoading = true
  state.villageCinemaListError = false
  if (state.view === 'settings') render()
  try {
    const res = await fetch('/api/village-cinemas')
    if (!res.ok) throw new Error()
    const data = await res.json()
    state.villageCinemaList = data.cinemas || []
  } catch {
    state.villageCinemaListError = true
    state.villageCinemaList = null
  }
  state.villageCinemaListLoading = false
  if (state.view === 'settings') render()
}

async function loadMovieDetail(id) {
  try {
    const detail = await getMovieDetails(id)
    if (state.selectedMovie?.id === id) {
      state.movieDetail = detail
      state.detailLoading = false
      if (state.view === 'detail') render()
    }
  } catch {
    state.detailLoading = false
    if (state.view === 'detail') render()
  }
}

async function loadSessions(movie) {
  if (import.meta.env.DEV || !store.hasAnyCinema()) {
    state.sessionsLoading = false
    if (state.view === 'detail') render()
    return
  }

  const hoytsCinemaIds  = store.getHoytsCinemaIds()
  const villageCinemaIds = store.getVillageCinemaIds()
  const dateOffset = state.selectedDate === 'today' ? 0 : 1
  const date = isoDate(dateOffset)

  try {
    const params = new URLSearchParams({ movieTitle: movie.title, date })
    if (hoytsCinemaIds.length)  params.set('hoytsCinemaIds',  hoytsCinemaIds.join(','))
    if (villageCinemaIds.length) params.set('villageCinemaIds', villageCinemaIds.join(','))

    const res = await fetch(`/api/sessions?${params}`)
    if (!res.ok) throw new Error()
    const data = await res.json()

    if (state.selectedMovie?.id === movie.id) {
      state.sessions = data.sessions
      state.sessionsLoading = false
      if (state.view === 'detail') render()
    }
  } catch {
    if (state.selectedMovie?.id === movie.id) {
      state.sessions = null
      state.sessionsLoading = false
      if (state.view === 'detail') render()
    }
  }
}

// ---- SERVICE WORKER ----

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// ---- INIT ----

state.loading = true
render()
loadMovies()
