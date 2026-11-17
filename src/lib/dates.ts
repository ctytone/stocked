/** All dates are local calendar days stored as "YYYY-MM-DD" strings. */

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function todayKey(): string {
  return toKey(new Date())
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(key: string): number {
  return fromKey(key).getDay()
}

/** Monday of the week (Mon–Sun) that contains this day. */
export function mondayOf(key: string): string {
  const wd = weekday(key)
  return addDays(key, wd === 0 ? -6 : 1 - wd)
}

/** The week to show by default: on Sunday you're planning the coming week. */
export function defaultWeekStart(today: string): string {
  return weekday(today) === 0 ? addDays(today, 1) : mondayOf(today)
}

/** Shopping covers through the next Sunday after today (on a Sunday, that's a week away). */
export function shoppingEnd(today: string): string {
  const wd = weekday(today)
  return addDays(today, wd === 0 ? 7 : 7 - wd)
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function label(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return fromKey(key).toLocaleDateString(undefined, opts)
}
