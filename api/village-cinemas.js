const VILLAGE_BASE = 'https://villagecinemas.com.au'
const VILLAGE_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://villagecinemas.com.au',
  Referer: 'https://villagecinemas.com.au/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

export default async function handler(req, res) {
  const r = await fetch(`${VILLAGE_BASE}/api/booking-widget/filters`, { headers: VILLAGE_HEADERS })
  if (!r.ok) return res.status(502).json({ error: 'Failed to fetch Village cinemas' })

  const data = await r.json()
  const victorian = (data.cinemas || [])
    .filter(c => c.state === 'VIC')
    .map(c => ({
      id: c.cinemaId,
      name: c.name,
      suburb: c.suburb,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
  res.json({ cinemas: victorian })
}
