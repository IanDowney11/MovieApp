const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'
const API_KEY = import.meta.env.VITE_TMDB_API_KEY

export function getPosterUrl(path, size = 'w342') {
  return path ? `${IMG}/${size}${path}` : null
}

export function hasApiKey() {
  return !!API_KEY
}

export async function getNowPlayingKidsMovies() {
  const fromDate = new Date()
  fromDate.setMonth(fromDate.getMonth() - 6)
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + 30)

  const base = {
    api_key: API_KEY,
    with_release_type: '3',
    'primary_release_date.gte': fromDate.toISOString().slice(0, 10),
    'primary_release_date.lte': toDate.toISOString().slice(0, 10),
    sort_by: 'popularity.desc',
    region: 'AU',
    page: '1',
    language: 'en-AU',
  }

  const [familyRes, animRes] = await Promise.all([
    fetch(`${BASE}/discover/movie?${new URLSearchParams({ ...base, with_genres: '10751' })}`),
    fetch(`${BASE}/discover/movie?${new URLSearchParams({ ...base, with_genres: '16' })}`),
  ])

  const [familyData, animData] = await Promise.all([
    familyRes.ok ? familyRes.json() : Promise.resolve({ results: [] }),
    animRes.ok ? animRes.json() : Promise.resolve({ results: [] }),
  ])

  if (!familyRes.ok && !animRes.ok) {
    throw new Error(`API error ${familyRes.status}`)
  }

  const seen = new Set()
  return [...(familyData.results || []), ...(animData.results || [])]
    .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
    .sort((a, b) => b.popularity - a.popularity)
}

// Search TMDB by title and fetch AU certification in one pipeline.
export async function searchAndEnrichFromTMDB(title) {
  if (!API_KEY) return null

  const searchRes = await fetch(`${BASE}/search/movie?${new URLSearchParams({
    api_key: API_KEY,
    query: title,
    language: 'en-AU',
    region: 'AU',
    include_adult: 'false',
  })}`)
  if (!searchRes.ok) return null
  const searchData = await searchRes.json()
  const movie = searchData.results?.[0]
  if (!movie) return null

  const detailRes = await fetch(`${BASE}/movie/${movie.id}?${new URLSearchParams({
    api_key: API_KEY,
    append_to_response: 'release_dates',
  })}`)
  if (!detailRes.ok) return { ...movie, au_certification: '' }
  const detail = await detailRes.json()

  const auEntry = detail.release_dates?.results?.find(r => r.iso_3166_1 === 'AU')
  const cert = auEntry?.release_dates?.[0]?.certification || ''

  return { ...movie, au_certification: cert, runtime: detail.runtime, overview: detail.overview || movie.overview }
}

export async function getMovieDetails(movieId) {
  const params = new URLSearchParams({
    api_key: API_KEY,
    append_to_response: 'release_dates',
  })

  const res = await fetch(`${BASE}/movie/${movieId}?${params}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()

  const auEntry = data.release_dates?.results?.find(r => r.iso_3166_1 === 'AU')
  data.au_certification = auEntry?.release_dates?.[0]?.certification || ''

  return data
}
