// Reads the schema.org Recipe data that most recipe sites embed in their pages.
// Shared by the Vercel function (api/import.js) and the local dev server (vite.config.ts).

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$)/i

export function checkUrl(raw) {
  let url
  try { url = new URL(raw) } catch { throw new Error("That doesn't look like a link.") }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Only http and https links work.')
  if (PRIVATE_HOST.test(url.hostname)) throw new Error("That link isn't a public website.")
  return url
}

function* walk(node) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return }
  yield node
  if (node['@graph']) yield* walk(node['@graph'])
  if (node.mainEntity) yield* walk(node.mainEntity)
}

const isRecipe = (n) => {
  const t = n['@type']
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))
}

const decode = (s) =>
  String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

function parseYield(y) {
  const values = Array.isArray(y) ? y : [y]
  for (const v of values) {
    const m = String(v ?? '').match(/\d+(\.\d+)?/)
    if (m) return Number(m[0])
  }
  return 1
}

/** recipeInstructions can be a string, a list of strings, HowToSteps, or HowToSections of steps. */
function parseSteps(node) {
  const out = []
  const visit = (n) => {
    if (!n) return
    if (typeof n === 'string') {
      for (const part of n.split(/<\/(?:p|li)>|<br\s*\/?>|\n/i)) {
        const line = decode(part)
        if (line) out.push(line)
      }
      return
    }
    if (Array.isArray(n)) { n.forEach(visit); return }
    if (typeof n === 'object') {
      if (n.itemListElement) visit(n.itemListElement)
      else if (n.text) visit(String(n.text))
      else if (n.name) visit(String(n.name))
    }
  }
  visit(node)
  return out.slice(0, 60)
}

export function parseRecipe(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, body] of blocks) {
    let json
    try { json = JSON.parse(body.trim()) } catch { continue }
    for (const node of walk(json)) {
      if (!isRecipe(node)) continue
      const ingredients = (node.recipeIngredient ?? node.ingredients ?? []).map(decode).filter(Boolean)
      return { name: decode(node.name ?? ''), makes: parseYield(node.recipeYield), ingredients, steps: parseSteps(node.recipeInstructions) }
    }
  }
  return null
}

export async function importRecipe(rawUrl) {
  const url = checkUrl(rawUrl)
  const res = await fetch(url, {
    // Many recipe sites turn away requests that don't look like a normal browser.
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  })
  if (res.status === 403 || res.status === 429) {
    throw new Error("That site blocks apps from reading its recipes.")
  }
  if (!res.ok) throw new Error(`The site answered with an error (${res.status}).`)
  const html = (await res.text()).slice(0, 3_000_000)
  const recipe = parseRecipe(html)
  if (!recipe || recipe.ingredients.length === 0) {
    throw new Error("Couldn't find a recipe on that page. Try typing it in.")
  }
  return recipe
}
