import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { importRecipe } from './api/recipe-parser.js'

/** Runs the same recipe import as the hosted /api/import function while you develop locally. */
function devImportApi(): Plugin {
  return {
    name: 'dev-import-api',
    configureServer(server) {
      server.middlewares.use('/api/import', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
        res.setHeader('content-type', 'application/json')
        try {
          if (!url) throw new Error('Add ?url= with a recipe link.')
          res.end(JSON.stringify(await importRecipe(url)))
        } catch (e) {
          res.statusCode = 422
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Import failed.' }))
        }
      })
    },
  }
}

// `vite build --mode single` makes one self-contained HTML file (used for the quick preview link).
export default defineConfig(({ mode }) => ({
  plugins: [react(), devImportApi(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}))
