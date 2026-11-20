/** Small line icons (24px grid, stroke = currentColor). Decorative: pair with visible text or an aria-label. */
const PATHS = {
  week: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 9.5h16M8.5 2.5v3M15.5 2.5v3M8 13h2M12 13h2M16 13h0M8 16.5h2M12 16.5h2',
  recipes: 'M6 3.5h9.5L19 7v13.5H6zM15 3.5V7.5h4M9 11h7M9 14.5h7M9 18h4',
  pantry: 'M5 3.5h14v17H5zM5 10h14M9 6.5h0M9 13.5v3',
  shop: 'M3.5 4.5h2.2l2 11h10.1l1.8-7.6H7M9.5 19.5h0M16.5 19.5h0',
  account: 'M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5zM4.5 20a7.5 7.5 0 0 1 15 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5M12 16.5h0M12 3.5l9 16H3z',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  link: 'M14 4.5h5.5V10M19.5 4.5L11 13M10 6H6.5A2 2 0 0 0 4.5 8v9.5a2 2 0 0 0 2 2H16a2 2 0 0 0 2-2V14',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
