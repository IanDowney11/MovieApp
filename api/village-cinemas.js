const VILLAGE_BASE = 'https://villagecinemas.com.au'

function scraperUrl(targetUrl) {
  const key = process.env.SCRAPERAPI_KEY
  if (!key) throw new Error('SCRAPERAPI_KEY not configured')
  return `https://api.scraperapi.com/?api_key=${key}&url=${encodeURIComponent(targetUrl)}`
}

export default async function handler(req, res) {
  if (!process.env.SCRAPERAPI_KEY) {
    return res.status(503).json({ error: 'SCRAPERAPI_KEY environment variable not set' })
  }

  let r
  try {
    // Village's filters endpoint requires POST
    r = await fetch(scraperUrl(`${VILLAGE_BASE}/api/booking-widget/filters`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Village via proxy', detail: String(err) })
  }

  if (!r.ok) {
    return res.status(502).json({ error: 'Village API error', status: r.status })
  }

  let data
  try {
    data = await r.json()
  } catch {
    return res.status(502).json({ error: 'Village API returned non-JSON' })
  }

  const victorian = (data.cinemas || [])
    .filter(c => c.state === 'VIC')
    .map(c => ({ id: c.cinemaId, name: c.name, suburb: c.suburb }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
  res.json({ cinemas: victorian })
}
