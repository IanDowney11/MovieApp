function movieSlug(title) {
  return title
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CINEMAS = [
  {
    id: 'hoyts',
    name: 'Hoyts',
    color: '#e8002d',
    abbr: 'H',
    getUrl(movie) {
      return `https://www.hoyts.com.au/movies/${movieSlug(movie.title)}`
    },
  },
  {
    id: 'event',
    name: 'Event Cinemas',
    color: '#0070c0',
    abbr: 'E',
    getUrl(movie) {
      return `https://www.eventcinemas.com.au/movie/${movieSlug(movie.title)}`
    },
  },
  {
    id: 'village',
    name: 'Village Cinemas',
    color: '#7b2d8b',
    abbr: 'V',
    getUrl(movie) {
      return `https://www.villagecinemas.com.au/movies/${movieSlug(movie.title)}`
    },
  },
  {
    id: 'reading',
    name: 'Reading Cinemas',
    color: '#d62027',
    abbr: 'R',
    getUrl(movie) {
      return `https://readingcinemas.com.au/film/${movieSlug(movie.title)}`
    },
  },
]

export function getCinemaById(id) {
  return CINEMAS.find(c => c.id === id)
}
