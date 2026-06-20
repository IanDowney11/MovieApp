const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const HOYTS_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://www.hoyts.com.au',
  Referer: 'https://www.hoyts.com.au/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

export default async function handler(req, res) {
  const cinemasRes = await fetch(`${HOYTS_BASE}/cinemas`, { headers: HOYTS_HEADERS })
  if (!cinemasRes.ok) {
    return res.status(502).json({ error: 'Failed to fetch Hoyts cinemas' })
  }

  const data = await cinemasRes.json()
  const all = Array.isArray(data) ? data : (data.cinemas || [])

  // Victorian postcodes: 3000–3999
  const victorian = all
    .filter(c => {
      const pc = parseInt(c.address?.postCode || '0', 10)
      return pc >= 3000 && pc <= 3999
    })
    .map(c => ({
      id: String(c.id),
      name: c.name || 'Unknown',
      suburb: c.suburb || c.address?.suburb || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
  res.json({ cinemas: victorian })
}
