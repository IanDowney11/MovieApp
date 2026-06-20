const KEYS = {
  HOYTS_CINEMA_IDS:   'kidflicks_hoyts_cinemas',
  VILLAGE_CINEMA_IDS: 'kidflicks_village_cinemas',
}

function makeChainStore(key) {
  return {
    getIds()        { const s = localStorage.getItem(key); return s ? JSON.parse(s) : [] },
    setIds(ids)     { localStorage.setItem(key, JSON.stringify(ids.map(String))) },
    toggle(id)      {
      const ids = this.getIds()
      const sid = String(id)
      const i = ids.indexOf(sid)
      if (i >= 0) ids.splice(i, 1); else ids.push(sid)
      this.setIds(ids)
    },
    isSelected(id)  { return this.getIds().includes(String(id)) },
  }
}

const hoyts  = makeChainStore(KEYS.HOYTS_CINEMA_IDS)
const village = makeChainStore(KEYS.VILLAGE_CINEMA_IDS)

export const store = {
  getHoytsCinemaIds:      ()   => hoyts.getIds(),
  setHoytsCinemaIds:      (ids) => hoyts.setIds(ids),
  toggleHoytsCinema:      (id)  => hoyts.toggle(id),
  isHoytsCinemaSelected:  (id)  => hoyts.isSelected(id),

  getVillageCinemaIds:    ()   => village.getIds(),
  setVillageCinemaIds:    (ids) => village.setIds(ids),
  toggleVillageCinema:    (id)  => village.toggle(id),
  isVillageCinemaSelected:(id)  => village.isSelected(id),

  hasAnyCinema() {
    return hoyts.getIds().length > 0 || village.getIds().length > 0
  },
}
