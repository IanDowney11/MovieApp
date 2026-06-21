import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import cinemasHandler      from './api/cinemas.js'
import sessionsHandler     from './api/sessions.js'
import villageCinemasHandler from './api/village-cinemas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json())

app.get('/api/cinemas',         (req, res) => cinemasHandler(req, res))
app.get('/api/sessions',        (req, res) => sessionsHandler(req, res))
app.get('/api/village-cinemas', (req, res) => villageCinemasHandler(req, res))

// Serve the Vite production build
app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`KidFlicks running on http://localhost:${PORT}`))
