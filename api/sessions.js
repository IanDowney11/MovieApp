const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const HOYTS_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://www.hoyts.com.au',
  Referer: 'https://www.hoyts.com.au/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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

// Fetch raw Hoyts data and resolve selected cinemas by exact ID.
async function fetchHoytsData(cinemaIds) {
  const idSet = new Set(cinemaIds.map(String))

  const [cinemasRes, moviesRes, sessionsRes] = await Promise.all([
    fetch(`${HOYTS_BASE}/cinemas`, { headers: HOYTS_HEADERS }),
    fetch(`${HOYTS_BASE}/movies`, { headers: HOYTS_HEADERS }),
    fetch(`${HOYTS_BASE}/sessions`, { headers: HOYTS_HEADERS }),
  ])
  if (!cinemasRes.ok || !moviesRes.ok || !sessionsRes.ok) return null

  const [cinemasData, moviesData, sessionsData] = await Promise.all([
    cinemasRes.json(), moviesRes.json(), sessionsRes.json(),
  ])

  const cinemas  = Array.isArray(cinemasData)  ? cinemasData  : (cinemasData.cinemas   || [])
  const movies   = Array.isArray(moviesData)   ? moviesData   : (moviesData.movies     || [])
  const sessions = Array.isArray(sessionsData) ? sessionsData : (sessionsData.sessions  || [])

  const selectedCinemas = cinemas.filter(c => idSet.has(String(c.id)))
  return { cinemas: selectedCinemas, movies, sessions }
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

    const vistaId = matchedMovie.vistaId || matchedMovie.id
    if (!vistaId) return []

    const matchingSessions = sessions.filter(s =>
      String(s.movieId) === String(vistaId) &&
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
      const movieId = movie.vistaId || movie.id
      if (!movieId) continue

      const movieSessions = daySessions.filter(s => String(s.movieId) === String(movieId))
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
        vistaId: String(movieId),
        classification: movie.classification || '',
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
  const { movieTitle, date, hoytsCinemaIds } = req.query

  if (!hoytsCinemaIds) {
    return res.status(400).json({ error: 'hoytsCinemaIds is required' })
  }

  const cinemaIds = hoytsCinemaIds.split(',').filter(Boolean)

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  if (movieTitle) {
    const results = { hoyts: [], event: [], village: [], reading: [] }
    results.hoyts = await fetchHoytsSessions(movieTitle, date, cinemaIds)
    return res.json({ sessions: results, date })
  }

  const byMovie = await fetchAllHoytsSessions(date, cinemaIds)
  return res.json({ byMovie, date })
}
