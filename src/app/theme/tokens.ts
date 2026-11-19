export const THEME_SCHEMES = ['light', 'dark'] as const
export type ThemeScheme = (typeof THEME_SCHEMES)[number]

export const THEME_FONTS = ['geist', 'geist-mono', 'system'] as const
export type ThemeFont = (typeof THEME_FONTS)[number]

export const THEME_EFFECTS = ['glass', 'noise', 'glow'] as const
export type ThemeEffect = (typeof THEME_EFFECTS)[number]

export interface ThemeOptions {
  font: ThemeFont
  effects: ThemeEffect[]
}

export interface ThemeInput {
  id: string
  name: string
  scheme: ThemeScheme
  version: number
  author: string
  license: string
  description?: string
  tokens: Partial<ThemeTokens>
  options?: Partial<ThemeOptions>
}

export interface Theme extends Omit<ThemeInput, 'tokens' | 'options'> {
  tokens: ThemeTokens
  options: ThemeOptions
}

export type ThemeToken = (typeof THEME_TOKENS)[number]
export type ThemeTokens = Record<ThemeToken, string>

/** Orden y nombres de los tokens expuestos a los temas. */
export const THEME_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'radius',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'brand',
  'brand-2',
  'success',
  'warning',
  'surface-glow',
  'overlay',
] as const

export const BASE_TOKENS: Record<ThemeScheme, ThemeTokens> = {
  light: {
    background: 'oklch(0.988 0.003 286)',
    foreground: 'oklch(0.19 0.02 286)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.19 0.02 286)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.19 0.02 286)',
    primary: 'oklch(0.56 0.235 293)',
    'primary-foreground': 'oklch(0.99 0 0)',
    secondary: 'oklch(0.965 0.008 290)',
    'secondary-foreground': 'oklch(0.25 0.03 288)',
    muted: 'oklch(0.962 0.006 290)',
    'muted-foreground': 'oklch(0.51 0.022 290)',
    accent: 'oklch(0.953 0.02 293)',
    'accent-foreground': 'oklch(0.4 0.15 293)',
    destructive: 'oklch(0.585 0.22 27)',
    border: 'oklch(0.912 0.008 290)',
    input: 'oklch(0.9 0.01 290)',
    ring: 'oklch(0.56 0.235 293 / 55%)',
    'chart-1': 'oklch(0.62 0.22 293)',
    'chart-2': 'oklch(0.7 0.14 180)',
    'chart-3': 'oklch(0.78 0.15 80)',
    'chart-4': 'oklch(0.66 0.2 10)',
    'chart-5': 'oklch(0.66 0.16 245)',
    radius: '0.75rem',
    sidebar: 'oklch(0.972 0.005 290)',
    'sidebar-foreground': 'oklch(0.22 0.02 288)',
    'sidebar-primary': 'oklch(0.56 0.235 293)',
    'sidebar-primary-foreground': 'oklch(0.99 0 0)',
    'sidebar-accent': 'oklch(0.94 0.015 293)',
    'sidebar-accent-foreground': 'oklch(0.34 0.1 293)',
    'sidebar-border': 'oklch(0.91 0.008 290)',
    'sidebar-ring': 'oklch(0.56 0.235 293 / 50%)',
    brand: 'oklch(0.56 0.235 293)',
    'brand-2': 'oklch(0.63 0.24 330)',
    success: 'oklch(0.65 0.16 155)',
    warning: 'oklch(0.78 0.16 78)',
    'surface-glow': 'oklch(0.56 0.235 293 / 0.12)',
    overlay: 'oklch(0 0 0 / 0.10)',
  },
  dark: {
    background: 'oklch(0.135 0.012 288)',
    foreground: 'oklch(0.965 0.006 290)',
    card: 'oklch(0.178 0.014 288)',
    'card-foreground': 'oklch(0.965 0.006 290)',
    popover: 'oklch(0.19 0.016 288)',
    'popover-foreground': 'oklch(0.965 0.006 290)',
    primary: 'oklch(0.7 0.18 293)',
    'primary-foreground': 'oklch(0.14 0.02 290)',
    secondary: 'oklch(0.235 0.016 288)',
    'secondary-foreground': 'oklch(0.96 0.006 290)',
    muted: 'oklch(0.225 0.014 288)',
    'muted-foreground': 'oklch(0.7 0.02 290)',
    accent: 'oklch(0.27 0.035 293)',
    'accent-foreground': 'oklch(0.94 0.03 293)',
    destructive: 'oklch(0.68 0.19 22)',
    border: 'oklch(1 0 0 / 9%)',
    input: 'oklch(1 0 0 / 14%)',
    ring: 'oklch(0.7 0.18 293 / 55%)',
    'chart-1': 'oklch(0.72 0.18 293)',
    'chart-2': 'oklch(0.74 0.13 180)',
    'chart-3': 'oklch(0.82 0.15 80)',
    'chart-4': 'oklch(0.72 0.18 10)',
    'chart-5': 'oklch(0.72 0.14 245)',
    radius: '0.75rem',
    sidebar: 'oklch(0.118 0.011 288)',
    'sidebar-foreground': 'oklch(0.93 0.006 290)',
    'sidebar-primary': 'oklch(0.7 0.18 293)',
    'sidebar-primary-foreground': 'oklch(0.14 0.02 290)',
    'sidebar-accent': 'oklch(0.23 0.025 293)',
    'sidebar-accent-foreground': 'oklch(0.95 0.02 293)',
    'sidebar-border': 'oklch(1 0 0 / 7%)',
    'sidebar-ring': 'oklch(0.7 0.18 293 / 50%)',
    brand: 'oklch(0.7 0.18 293)',
    'brand-2': 'oklch(0.74 0.2 330)',
    success: 'oklch(0.74 0.16 155)',
    warning: 'oklch(0.82 0.15 78)',
    'surface-glow': 'oklch(0.7 0.18 293 / 0.16)',
    overlay: 'oklch(0 0 0 / 0.10)',
  },
}

export const DEFAULT_THEME_ID = 'qomu-dark'

export function resolveTheme(input: ThemeInput): Theme {
  return {
    ...input,
    tokens: { ...BASE_TOKENS[input.scheme], ...input.tokens },
    options: { font: 'geist', effects: [], ...input.options },
  }
}
