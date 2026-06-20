const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const HOYTS_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://www.hoyts.com.au',
  Referer: 'https://www.hoyts.com.au/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

const VILLAGE_BASE = 'https://villagecinemas.com.au'

function villageScraperUrl(targetUrl) {
  const key = process.env.SCRAPERAPI_KEY
  if (!key) throw new Error('SCRAPERAPI_KEY not configured')
  return `https://api.scraperapi.com/?api_key=${key}&url=${encodeURIComponent(targetUrl)}&premium=true`
}

function formatVillageTime(isoString) {
  // Showtime is already in AU local time e.g. "2026-06-21T09:30:00.000000+10:00"
  if (!isoString) return ''
  const timePart = isoString.split('T')[1] || ''
  const [h, m] = timePart.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

async function fetchVillageHits(cinemaId, date) {
  const params = new URLSearchParams({ 'f.c': cinemaId })
  if (date) params.set('f.d', date)
  const targetUrl = `${VILLAGE_BASE}/api/algolia/sessions/hits?${params}`
  try {
    const r = await fetch(villageScraperUrl(targetUrl))
    if (!r.ok) return []
    const d = await r.json()
    const hits = d.hits || []
    return date ? hits.filter(h => h.date === date) : hits
  } catch { return [] }
}

async function fetchAllVillageSessions(date, cinemaIds) {
  try {
    const allHits = (await Promise.all(cinemaIds.map(id => fetchVillageHits(id, date)))).flat()
    if (!allHits.length) return []

    const movieMap = {}
    for (const hit of allHits) {
      const hoCode = hit.movie?.movieHoCode
      if (!hoCode) continue
      if (!movieMap[hoCode]) {
        movieMap[hoCode] = {
          name: hit.movie.title,
          hoCode,
          rating: (hit.movie.classification?.description || '').trim(),
          posterUrl: hit.movie.poster?.image?.url || null,
          chain: 'village',
          locMap: {},
        }
      }
      const key = hit.cinema.cinemaId
      if (!movieMap[hoCode].locMap[key]) {
        movieMap[hoCode].locMap[key] = { cinema: hit.cinema.name, times: [] }
      }
      movieMap[hoCode].locMap[key].times.push({
        time: formatVillageTime(hit.showtime),
        bookingUrl: `${VILLAGE_BASE}/sessions/${hit.sessionId}`,
        _iso: hit.showtime,
      })
    }

    return Object.values(movieMap).map(m => ({
      name: m.name,
      hoCode: m.hoCode,
      rating: m.rating,
      posterUrl: m.posterUrl,
      chain: 'village',
      locations: Object.values(m.locMap).map(loc => ({
        cinema: loc.cinema,
        times: loc.times
          .sort((a, b) => a._iso.localeCompare(b._iso))
          .map(({ time, bookingUrl }) => ({ time, bookingUrl })),
      })),
    }))
  } catch (err) {
    console.error('Village all-sessions error:', err)
    return []
  }
}

async function fetchVillageSessions(movieTitle, date, cinemaIds) {
  try {
    const allHits = (await Promise.all(cinemaIds.map(id => fetchVillageHits(id, date)))).flat()
    const matching = allHits.filter(h => titlesMatch(h.movie?.title, movieTitle))
    if (!matching.length) return []

    const locMap = {}
    for (const hit of matching) {
      const key = hit.cinema.cinemaId
      if (!locMap[key]) locMap[key] = { cinema: hit.cinema.name, times: [] }
      locMap[key].times.push({
        time: formatVillageTime(hit.showtime),
        bookingUrl: `${VILLAGE_BASE}/sessions/${hit.sessionId}`,
        _iso: hit.showtime,
      })
    }

    return Object.values(locMap).map(loc => ({
      cinema: loc.cinema,
      times: loc.times
        .sort((a, b) => a._iso.localeCompare(b._iso))
        .map(({ time, bookingUrl }) => ({ time, bookingUrl })),
    }))
  } catch (err) {
    console.error('Village sessions error:', err)
    return []
  }
}

// vistaId can be a comma-separated list e.g. "HO00008574,HO00011215"
function getMovieIds(movie) {
  const raw = movie.vistaId || ''
  const ids = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []
  if (!ids.length && movie.id) ids.push(String(movie.id))
  return ids
}

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function titlesMatch(a, b) {
  if (!a || !b) return false
  const na = normalise(a)
  const nb = normalise(b)
  return na === nb || (nb.length > 2 && (na.startsWith(nb) || nb.startsWith(na)))
}

function formatTime(isoString) {
  if (!isoString) return ''
  const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString
  const [h, m] = timePart.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function sortableTime(formatted) {
  const [time, period] = formatted.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}

// Fetch movies + per-cinema sessions. cinemaIds are the codes Hoyts uses (e.g. "FRANKS").
// We skip fetching /cinemas here — it was causing the sessions call to fail under combined load.
async function fetchHoytsData(cinemaIds) {
  const [moviesRes, ...sessionResponses] = await Promise.all([
    fetch(`${HOYTS_BASE}/movies`, { headers: HOYTS_HEADERS }),
    ...cinemaIds.map(code => fetch(`${HOYTS_BASE}/sessions/${code}`, { headers: HOYTS_HEADERS })),
  ])

  if (!moviesRes.ok) return null

  const moviesData = await moviesRes.json()
  const movies = Array.isArray(moviesData) ? moviesData : (moviesData.movies || [])

  let allSessions = []
  for (let i = 0; i < sessionResponses.length; i++) {
    if (!sessionResponses[i].ok) continue
    const d = await sessionResponses[i].json()
    const cinemaSessions = Array.isArray(d) ? d : (d.sessions || [])
    const cinemaId = cinemaIds[i]
    allSessions = allSessions.concat(
      cinemaSessions.map(s => ({ ...s, cinemaId: s.cinemaId || cinemaId }))
    )
  }

  // Minimal stubs — cinema names are resolved in the UI from the cached /api/cinemas list
  const cinemas = cinemaIds.map(id => ({ id }))
  return { cinemas, movies, sessions: allSessions }
}

// Detail view: sessions for one specific movie at the selected cinemas.
async function fetchHoytsSessions(movieTitle, date, cinemaIds) {
  try {
    const data = await fetchHoytsData(cinemaIds)
    if (!data || data.cinemas.length === 0) return []

    const { cinemas, movies, sessions } = data
    const cinemaIdSet = new Set(cinemas.map(c => String(c.id)))

    const matchedMovie = movies.find(m => titlesMatch(m.name, movieTitle))
    if (!matchedMovie) return []

    const movieIds = getMovieIds(matchedMovie)
    if (!movieIds.length) return []
    const movieIdSet = new Set(movieIds)

    const matchingSessions = sessions.filter(s =>
      movieIdSet.has(String(s.movieId)) &&
      cinemaIdSet.has(String(s.cinemaId)) &&
      !s.disabled &&
      (s.date || '').substring(0, 10) === date
    )
    if (matchingSessions.length === 0) return []

    const byCinema = {}
    for (const s of matchingSessions) {
      const key = String(s.cinemaId)
      if (!byCinema[key]) {
        const cinemaObj = cinemas.find(c => String(c.id) === key)
        byCinema[key] = { cinema: cinemaObj?.name || key, times: [] }
      }
      const slug = matchedMovie.slug || normalise(matchedMovie.name).replace(/\s+/g, '-')
      byCinema[key].times.push({
        time: formatTime(s.date),
        bookingUrl: s.link
          ? `https://www.hoyts.com.au${s.link}`
          : `https://www.hoyts.com.au/movies/${slug}`,
      })
    }

    return Object.values(byCinema).map(group => ({
      ...group,
      times: group.times.sort((a, b) => sortableTime(a.time) - sortableTime(b.time)),
    }))
  } catch (err) {
    console.error('Hoyts fetch error:', err)
    return []
  }
}

// Home view: all movies playing at the selected cinemas on a date.
async function fetchAllHoytsSessions(date, cinemaIds) {
  try {
    const data = await fetchHoytsData(cinemaIds)
    if (!data || data.cinemas.length === 0) return []

    const { cinemas, movies, sessions } = data
    const cinemaIdSet = new Set(cinemas.map(c => String(c.id)))

    const daySessions = sessions.filter(s =>
      !s.disabled &&
      cinemaIdSet.has(String(s.cinemaId)) &&
      (s.date || '').substring(0, 10) === date
    )
    if (daySessions.length === 0) return []

    const results = []
    for (const movie of movies) {
      const movieIds = getMovieIds(movie)
      if (!movieIds.length) continue

      const idSet = new Set(movieIds)
      const movieSessions = daySessions.filter(s => idSet.has(String(s.movieId)))
      if (movieSessions.length === 0) continue

      const locMap = {}
      for (const s of movieSessions) {
        const key = String(s.cinemaId)
        if (!locMap[key]) {
          const cinemaObj = cinemas.find(c => String(c.id) === key)
          locMap[key] = { cinema: cinemaObj?.name || key, raw: [] }
        }
        const slug = movie.slug || normalise(movie.name).replace(/\s+/g, '-')
        locMap[key].raw.push({
          iso: s.date,
          time: formatTime(s.date),
          bookingUrl: s.link
            ? `https://www.hoyts.com.au${s.link}`
            : `https://www.hoyts.com.au/movies/${slug}`,
        })
      }

      results.push({
        name: movie.name,
        vistaId: movieIds[0],
        rating: movie.rating?.id || movie.classification || '',
        chain: 'hoyts',
        locations: Object.values(locMap).map(loc => ({
          cinema: loc.cinema,
          times: loc.raw
            .sort((a, b) => a.iso.localeCompare(b.iso))
            .map(({ time, bookingUrl }) => ({ time, bookingUrl })),
        })),
      })
    }

    return results
  } catch (err) {
    console.error('Hoyts all-sessions error:', err)
    return []
  }
}

export default async function handler(req, res) {
  const { movieTitle, date, hoytsCinemaIds, villageCinemaIds, debug } = req.query

  const hoytsCodes  = hoytsCinemaIds  ? hoytsCinemaIds.split(',').filter(Boolean)  : []
  const villageCodes = villageCinemaIds ? villageCinemaIds.split(',').filter(Boolean) : []

  if (!hoytsCodes.length && !villageCodes.length) {
    return res.status(400).json({ error: 'At least one of hoytsCinemaIds or villageCinemaIds is required' })
  }

  // Legacy: cinemaIds for debug endpoints defaults to hoyts codes
  const cinemaIds = hoytsCodes

  res.setHeader('Cache-Control', 'no-store')

  // Raw proxy — show exactly what Hoyts returns for the cinema session endpoint
  if (debug === 'raw') {
    const code = cinemaIds[0]
    const r = await fetch(`${HOYTS_BASE}/sessions/${code}`, { headers: HOYTS_HEADERS })
    const text = await r.text()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(JSON.stringify({
      status: r.status,
      ok: r.ok,
      url: `${HOYTS_BASE}/sessions/${code}`,
      responsePreview: text.slice(0, 2000),
    }))
  }

  // Check the filters endpoint — may have different sessions to /sessions/CODE
  if (debug === 'filters') {
    const slug = (cinemaIds[0] || '').toLowerCase()
    const url = `${HOYTS_BASE}/sessions/filters/cinema:${slug}`
    const r = await fetch(url, { headers: HOYTS_HEADERS })
    const text = await r.text()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(JSON.stringify({
      status: r.status,
      ok: r.ok,
      url,
      responsePreview: text.slice(0, 3000),
    }))
  }

  if (debug === '1') {
    const data = await fetchHoytsData(cinemaIds)
    if (!data) return res.status(502).json({ error: 'Hoyts fetch failed' })
    const { cinemas, movies, sessions } = data

    // Show raw unfiltered sessions so we can inspect their structure
    const sampleSession = sessions[0] || null
    const sessionKeys = sampleSession ? Object.keys(sampleSession) : []

    // Try date filter with whatever key looks like a date
    const dateKey = sessionKeys.find(k => typeof sampleSession?.[k] === 'string' && sampleSession[k].match(/^\d{4}-\d{2}-\d{2}/))
    const filteredByDate = date && dateKey
      ? sessions.filter(s => (s[dateKey] || '').substring(0, 10) === date)
      : sessions

    const movieIdsWithSessions = new Set(filteredByDate.map(s => String(s.movieId)))

    return res.json({
      selectedCinemas: cinemaIds,
      rawSessionCount: sessions.length,
      filteredSessionCount: filteredByDate.length,
      detectedDateKey: dateKey || null,
      sampleSession,
      moviesOnDate: movies
        .filter(m => getMovieIds(m).some(id => movieIdsWithSessions.has(id)))
        .map(m => ({ id: m.id, vistaId: m.vistaId, name: m.name })),
      allMovieCount: movies.length,
    })
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  if (movieTitle) {
    const [hoytsSessions, villageSessions] = await Promise.all([
      hoytsCodes.length  ? fetchHoytsSessions(movieTitle, date, hoytsCodes)   : Promise.resolve([]),
      villageCodes.length ? fetchVillageSessions(movieTitle, date, villageCodes) : Promise.resolve([]),
    ])
    return res.json({ sessions: { hoyts: hoytsSessions, village: villageSessions }, date })
  }

  const [hoytsByMovie, villageByMovie] = await Promise.all([
    hoytsCodes.length  ? fetchAllHoytsSessions(date, hoytsCodes)   : Promise.resolve([]),
    villageCodes.length ? fetchAllVillageSessions(date, villageCodes) : Promise.resolve([]),
  ])
  return res.json({ byMovie: [...hoytsByMovie, ...villageByMovie], date })
}
