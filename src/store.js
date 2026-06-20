const KEYS = {
  HOYTS_CINEMA_IDS: 'kidflicks_hoyts_cinemas',
}

export const store = {
  getHoytsCinemaIds() {
    const stored = localStorage.getItem(KEYS.HOYTS_CINEMA_IDS)
    return stored ? JSON.parse(stored) : []
  },

  setHoytsCinemaIds(ids) {
    localStorage.setItem(KEYS.HOYTS_CINEMA_IDS, JSON.stringify(ids.map(String)))
  },

  toggleHoytsCinema(id) {
    const ids = this.getHoytsCinemaIds()
    const sid = String(id)
    const idx = ids.indexOf(sid)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(sid)
    this.setHoytsCinemaIds(ids)
  },

  isHoytsCinemaSelected(id) {
    return this.getHoytsCinemaIds().includes(String(id))
  },
}
