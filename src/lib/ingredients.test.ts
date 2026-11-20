import { describe, expect, it } from 'vitest'
import { guessLocation, ingredientName, isStaple } from './ingredients'

describe('ingredient names', () => {
  it.each([
    ['1 lb lean ground beef, browned', 'Lean ground beef'],
    ['1 (8 oz) package cream cheese, softened', 'Cream cheese'],
    ['2 cups shredded cooked chicken', 'Shredded cooked chicken'],
    ['½ cup ranch dressing', 'Ranch dressing'],
    ['1/2 cup Frank’s RedHot sauce', 'Frank’s RedHot sauce'],
    ['3 large eggs', 'Eggs'],
    ['2-3 cloves garlic, minced', 'Garlic'],
    ['Salt and pepper to taste', 'Salt and pepper'],
  ])('%s -> %s', (line, name) => {
    expect(ingredientName(line)).toBe(name)
  })

  it('spots staples but not real ingredients that contain the word', () => {
    expect(isStaple('1 tsp kosher salt')).toBe(true)
    expect(isStaple('2 tbsp olive oil')).toBe(true)
    expect(isStaple('1 red bell pepper, diced')).toBe(false)
    expect(isStaple('1 lb ground beef')).toBe(false)
  })

  it('guesses where things are kept', () => {
    expect(guessLocation('Cream cheese')).toBe('fridge')
    expect(guessLocation('Frozen peas')).toBe('freezer')
    expect(guessLocation('Tortilla chips')).toBe('pantry')
  })
})
