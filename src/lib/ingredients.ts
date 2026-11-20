import type { Item, Location } from './types'

const UNITS = [
  'cups?', 'c', 'tablespoons?', 'tbsps?', 'tbs', 'tb', 'teaspoons?', 'tsps?', 'ounces?', 'oz', 'pounds?', 'lbs?',
  'grams?', 'g', 'kilograms?', 'kg', 'milliliters?', 'ml', 'liters?', 'l', 'quarts?', 'qt', 'pints?', 'pt',
  'cans?', 'jars?', 'packages?', 'pkgs?', 'packets?', 'bags?', 'boxes?', 'bottles?', 'containers?', 'tubs?',
  'cloves?', 'pinch(es)?', 'dash(es)?', 'sticks?', 'slices?', 'pieces?', 'heads?', 'bunch(es)?', 'sprigs?',
  'handfuls?', 'scoops?', 'fl', 'fluid',
]
const SIZES = ['large', 'medium', 'small', 'whole', 'heaping', 'level', 'scant', 'generous']
const QTY = /^[\d\s./½⅓⅔¼¾⅛⅜⅝⅞⅕-]+/
const UNIT_RE = new RegExp(`^(${[...UNITS, ...SIZES].join('|')})\\.?\\s+`, 'i')

/** "1 (8 oz) package cream cheese, softened" -> "Cream cheese" */
export function ingredientName(line: string): string {
  let s = line
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  s = s.split(/,|;| - | – /)[0]
  for (let i = 0; i < 4; i++) {
    const before = s
    s = s.replace(QTY, '').trimStart()
    s = s.replace(/^(to|or)\s+[\d./½⅓⅔¼¾-]+\s*/i, '')
    s = s.replace(UNIT_RE, '')
    s = s.replace(/^of\s+/i, '')
    if (s === before) break
  }
  s = s
    .replace(/\b(to taste|divided|optional|for serving|for garnish|or more|as needed|plus more)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return line.trim()
  return s[0].toUpperCase() + s.slice(1)
}

const STAPLES =
  /\b(salt|pepper(corns)?|water|ice|oil|cooking spray|nonstick spray|baking soda|baking powder|vanilla|extract|cumin|paprika|oregano|basil leaves dried|thyme|rosemary|cinnamon|nutmeg|chili powder|chilli powder|cayenne|garlic powder|onion powder|italian seasoning|seasoning|red pepper flakes|bay leaf|bay leaves|spice|spices)\b/i
const NOT_STAPLE = /\b(bell pepper|peppers?\s+jack|pepperoni|jalape|poblano|chipotle|roasted red pepper)/i

/** Things most kitchens always have; default these to "not tracked". */
export function isStaple(line: string): boolean {
  const name = ingredientName(line)
  return STAPLES.test(name) && !NOT_STAPLE.test(name)
}

const FREEZER = /\b(frozen|ice cream)\b/i
const FRIDGE =
  /\b(chicken|beef|pork|turkey|sausage|bacon|ham|steak|fish|salmon|tuna steak|shrimp|milk|cream|cheese|cheddar|mozzarella|parmesan|butter|yogurt|eggs?|sour cream|tofu|lettuce|spinach|kale|cilantro|parsley|celery|carrots?|cucumber|berries|strawberr|blueberr|grapes|deli|hot sauce|ranch|mayo|mayonnaise|hummus|salsa)\b/i

export function guessLocation(name: string): Location {
  if (FREEZER.test(name)) return 'freezer'
  if (FRIDGE.test(name)) return 'fridge'
  return 'pantry'
}

/** Guess which pantry item an imported line like "1 lb lean ground beef" refers to. */
export function guessItem(line: string, items: Item[]): string {
  const text = line.toLowerCase()
  let best = ''
  let bestScore = 0
  for (const it of items) {
    if (it.batchOf) continue
    const words = it.name.toLowerCase().replace(/\(.*?\)/g, '').split(/\W+/).filter((w) => w.length > 2)
    const score = words.filter((w) => text.includes(w)).length / (words.length || 1)
    if (score > bestScore) { bestScore = score; best = it.id }
  }
  return bestScore >= 0.5 ? best : ''
}

/** Common things people keep at home, for the quick-add sheet. */
export const COMMON_ITEMS: { name: string; location: Location; servingsPerPackage: number }[] = [
  { name: 'Eggs (dozen)', location: 'fridge', servingsPerPackage: 6 },
  { name: 'Milk (gallon)', location: 'fridge', servingsPerPackage: 16 },
  { name: 'Greek yogurt (tub)', location: 'fridge', servingsPerPackage: 8 },
  { name: 'Butter', location: 'fridge', servingsPerPackage: 16 },
  { name: 'Shredded cheese (bag)', location: 'fridge', servingsPerPackage: 8 },
  { name: 'Chicken breast (pack)', location: 'fridge', servingsPerPackage: 4 },
  { name: 'Ground beef (1 lb)', location: 'fridge', servingsPerPackage: 4 },
  { name: 'Deli turkey', location: 'fridge', servingsPerPackage: 5 },
  { name: 'Bread (loaf)', location: 'pantry', servingsPerPackage: 10 },
  { name: 'Granola', location: 'pantry', servingsPerPackage: 10 },
  { name: 'Oatmeal', location: 'pantry', servingsPerPackage: 15 },
  { name: 'Rice (bag)', location: 'pantry', servingsPerPackage: 20 },
  { name: 'Pasta (box)', location: 'pantry', servingsPerPackage: 8 },
  { name: 'Marinara (jar)', location: 'pantry', servingsPerPackage: 4 },
  { name: 'Tortillas', location: 'pantry', servingsPerPackage: 8 },
  { name: 'Peanut butter', location: 'pantry', servingsPerPackage: 14 },
  { name: 'Bananas (bunch)', location: 'pantry', servingsPerPackage: 6 },
  { name: 'Frozen vegetables', location: 'freezer', servingsPerPackage: 4 },
  { name: 'Frozen pizza', location: 'freezer', servingsPerPackage: 3 },
]
