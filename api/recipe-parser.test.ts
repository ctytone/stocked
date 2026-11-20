import { describe, expect, it } from 'vitest'
import { checkUrl, parseRecipe } from './recipe-parser.js'

const page = (json: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`

describe('recipe parser', () => {
  it('reads a Recipe inside @graph (WordPress style)', () => {
    const html = page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Page' },
        { '@type': ['Recipe'], name: 'Spaghetti &amp; Meatballs', recipeYield: ['4', '4 servings'], recipeIngredient: ['1 lb ground beef', '1 jar marinara'] },
      ],
    })
    expect(parseRecipe(html)).toEqual({ name: 'Spaghetti & Meatballs', makes: 4, ingredients: ['1 lb ground beef', '1 jar marinara'], steps: [] })
  })

  it('reads steps from HowToSections and plain strings', () => {
    const html = page({
      '@type': 'Recipe', name: 'Dip', recipeIngredient: ['1 cup cheese'],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Prep', itemListElement: [{ '@type': 'HowToStep', text: 'Heat oven.' }, { '@type': 'HowToStep', text: 'Mix &amp; spread.' }] },
        'Bake 20 minutes.',
      ],
    })
    expect(parseRecipe(html)?.steps).toEqual(['Heat oven.', 'Mix & spread.', 'Bake 20 minutes.'])
  })

  it('returns null when the page has no recipe', () => {
    expect(parseRecipe('<html></html>')).toBeNull()
  })

  it('refuses private addresses', () => {
    expect(() => checkUrl('http://localhost:3000')).toThrow()
    expect(() => checkUrl('http://192.168.1.1')).toThrow()
    expect(checkUrl('https://www.allrecipes.com/x').hostname).toBe('www.allrecipes.com')
  })
})
