const VILLAGE_BASE = 'https://villagecinemas.com.au'

export default async function handler(req, res) {
  const { debug } = req.query

  // Try plain fetch first (some APIs block when Origin/Referer look like scrapers)
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  }

  const url = `${VILLAGE_BASE}/api/booking-widget/filters`
  let r
  try {
    r = await fetch(url, { headers })
  } catch (err) {
    return res.status(502).json({ error: 'Network error fetching Village cinemas', detail: String(err) })
  }

  if (debug === '1') {
    const text = await r.text()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(JSON.stringify({
      status: r.status,
      ok: r.ok,
      contentType: r.headers.get('content-type'),
      bodyPreview: text.slice(0, 2000),
    }))
  }

  if (!r.ok) {
    return res.status(502).json({
      error: 'Failed to fetch Village cinemas',
      status: r.status,
      contentType: r.headers.get('content-type'),
    })
  }

  let data
  try {
    data = await r.json()
  } catch {
    return res.status(502).json({ error: 'Village API returned non-JSON response' })
  }

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
