const VILLAGE_BASE = 'https://villagecinemas.com.au'
const VILLAGE_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

export default async function handler(req, res) {
  let r, text
  try {
    r = await fetch(`${VILLAGE_BASE}/api/booking-widget/filters`, {
      method: 'POST',
      headers: VILLAGE_HEADERS,
      body: '{}',
    })
    text = await r.text()
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Village', detail: String(err) })
  }

  if (!r.ok) {
    return res.status(502).json({ error: 'Village API error', status: r.status, body: text.slice(0, 300) })
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'Village returned non-JSON', body: text.slice(0, 300) })
  }

  const victorian = (data.cinemas || [])
    .filter(c => c.state === 'VIC')
    .map(c => ({ id: c.cinemaId, name: c.name, suburb: c.suburb }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
  res.json({ cinemas: victorian })
}
