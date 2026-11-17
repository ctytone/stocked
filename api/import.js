// Vercel serverless function: GET /api/import?url=https://...
import { importRecipe } from './recipe-parser.js'

export default async function handler(req, res) {
  const url = req.query?.url
  if (!url) return res.status(400).json({ error: 'Add ?url= with a recipe link.' })
  try {
    const recipe = await importRecipe(String(url))
    res.status(200).json(recipe)
  } catch (e) {
    res.status(422).json({ error: e instanceof Error ? e.message : 'Import failed.' })
  }
}
