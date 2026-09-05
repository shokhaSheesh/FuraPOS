import { useTheme } from '@/app/providers/ThemeProvider'

/**
 * Chart colour system.
 *
 * These are NOT the UI tokens. Brand yellow #FFCB00 measures 1.48:1 against a
 * white chart surface — far below the 3:1 floor for a mark — and near-black has
 * zero chroma, so it reads as grey rather than as an identity. Both fail the
 * categorical palette checks, which is why chart series come from the validated
 * palette below rather than from the brand palette.
 *
 * The order is the colour-blindness safety mechanism and must not be changed:
 * re-ordering it to lead with the brand gold was tried and failed the
 * normal-vision floor (magenta↔orange ΔE 12.9, below the required 15).
 * Verified with the dataviz palette validator — all checks pass in both modes.
 *
 * Brand presence in a chart comes from slot 4, the gold, which is used for a
 * single-series chart where direct labels and a tooltip supply the relief its
 * sub-3:1 contrast requires.
 */
export const CHART_SERIES_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 gold — the brand-adjacent slot
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const

export const CHART_SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const

/** Single-series charts use the gold, for brand presence without a CVD risk. */
export const CHART_BRAND = { light: '#eda100', dark: '#c98500' } as const

const INK = {
  light: { grid: '#e1e0d9', axis: '#c3c2b7', label: '#898781', tooltipBg: '#ffffff' },
  dark: { grid: '#2c2c2a', axis: '#383835', label: '#898781', tooltipBg: '#161616' },
} as const

export function useChartTheme() {
  const { resolved } = useTheme()
  const dark = resolved === 'dark'
  return {
    series: dark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT,
    brand: dark ? CHART_BRAND.dark : CHART_BRAND.light,
    ink: dark ? INK.dark : INK.light,
    isDark: dark,
  }
}

/** Never generate a 9th hue — fold the tail into "Other" instead. */
export const MAX_CHART_SERIES = 8
