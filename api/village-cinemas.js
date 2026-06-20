const VILLAGE_BASE = 'https://villagecinemas.com.au'

function scraperUrl(targetUrl) {
  const key = process.env.SCRAPERAPI_KEY
  if (!key) throw new Error('SCRAPERAPI_KEY not configured')
  return `https://api.scraperapi.com/?api_key=${key}&url=${encodeURIComponent(targetUrl)}&premium=true`
}

export default async function handler(req, res) {
  const { debug } = req.query

  if (!process.env.SCRAPERAPI_KEY) {
    return res.status(503).json({ error: 'SCRAPERAPI_KEY environment variable not set' })
  }

  let r, text
  try {
    r = await fetch(scraperUrl(`${VILLAGE_BASE}/api/booking-widget/filters`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    text = await r.text()
  } catch (err) {
    return res.status(502).json({ error: 'Network error reaching ScraperAPI', detail: String(err) })
  }

  if (debug === '1') {
    return res.status(200).json({
      status: r.status,
      ok: r.ok,
      contentType: r.headers.get('content-type'),
      bodyPreview: text.slice(0, 3000),
    })
  }

  if (!r.ok) {
    return res.status(502).json({ error: 'Village API error', status: r.status, bodyPreview: text.slice(0, 500) })
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'Village API returned non-JSON', bodyPreview: text.slice(0, 500) })
  }

  const victorian = (data.cinemas || [])
    .filter(c => c.state === 'VIC')
    .map(c => ({ id: c.cinemaId, name: c.name, suburb: c.suburb }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
  res.json({ cinemas: victorian })
}
