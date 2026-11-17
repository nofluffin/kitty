/**
 * Greyscale tokens taken from the lo-fi wireframes. Final visual design replaces
 * these values; components only read from here.
 */
export const colors = {
  page: '#F4F3EF',
  surface: '#FFFFFF',
  sunken: '#E8E7E2',
  ink: '#0B0B0B',
  inkOnDark: '#FFFFFF',
  muted: '#5F5E5A',
  faint: '#8A8985',
  line: '#8A8985',
  lineSoft: '#C9C8C3',
  danger: '#B42318',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.muted },
  bodyInk: { fontSize: 16, lineHeight: 23, color: colors.ink },
  small: { fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
} as const;

/** Minimum touch target. */
export const TOUCH = 48;
