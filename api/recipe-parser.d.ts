export interface ImportedRecipe {
  name: string
  makes: number
  ingredients: string[]
  steps: string[]
}
export function checkUrl(raw: string): URL
export function parseRecipe(html: string): ImportedRecipe | null
export function importRecipe(rawUrl: string): Promise<ImportedRecipe>
