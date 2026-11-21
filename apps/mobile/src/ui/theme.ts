/**
 * Tokens measured from Kitty-v1-wireframes.pdf. The wires are drawn on a
 * 390 x 844 pt phone at 0.6 scale, so every value here is (PDF pt / 0.6).
 *
 * Fonts: the wires use Adrianna (Chank Co., commercial). Until Kitty has an
 * app and web licence and the font files, DM Sans stands in: it was the closest
 * free match by text width (within about 3%). To switch, add the Adrianna files,
 * load them in src/app/_layout.tsx and change the two names in `fonts`.
 */
import type { TextStyle } from 'react-native';

export const fonts = {
  regular: 'DMSans_400Regular',
  bold: 'DMSans_700Bold',
} as const;

export const colors = {
  /** Screen background. */
  page: '#F6F4EE',
  /** Cards, header, inputs. */
  surface: '#FFFFFF',
  /** Avatar fill. */
  sunken: '#EDEBE6',
  /** Headings, values and text on selected options. */
  ink: '#0A0A0A',
  inkOnDark: '#FFFFFF',
  /** Body copy and section labels. */
  text: '#3D3D3D',
  /** Dates, hints, statuses. */
  muted: '#6B6B6B',
  /** Every border, rule and divider. */
  line: '#7A7A7A',
  /** Unfilled part of progress bars. */
  track: '#D4D4D4',
  /** Not in the greyscale wires; errors need to stand out. */
  danger: '#B42318',
  /** Main action buttons (Raj, 20 Nov 2026), with white text. */
  action: '#52A447',
  /** Selected options: Veg/Non-veg, Moment/Goal, chips (Raj, 20 Nov 2026), with ink text. */
  selected: '#9F9484',
  /** Destructive actions such as Archive (Raj, 21 Nov 2026), with white text. */
  destructive: '#ED2939',
  /** The MOMENT tag on kitty cards (Raj, 20 Nov 2026), with white text. */
  moment: '#F38427',
  /** The GOAL tag on kitty cards (Raj, 21 Nov 2026), with white text. */
  goal: '#4682B4',
} as const;

export const layout = {
  /** Side margin on every screen. */
  gutter: 20,
  /** Space between the header and the first content. */
  top: 24,
  headerHeight: 56,
  /** Back arrow box, so titles start 56 pt from the edge. */
  backWidth: 36,
  inputHeight: 47,
  buttonHeight: 51,
  border: 1,
  /** Inputs, code boxes and badges have a slight rounding. Cards and buttons are square. */
  radius: 3,
  avatar: 43,
  cardPadding: 16,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

const regular = { fontFamily: fonts.regular, fontWeight: 'normal' } as const;
const bold = { fontFamily: fonts.bold, fontWeight: 'normal' } as const;

export const type = {
  /** "Kitty" on top-level screens. */
  appTitle: { ...bold, fontSize: 20, lineHeight: 24, color: colors.ink },
  /** Screen name next to a back arrow, e.g. "Enter the code". */
  screenTitle: { ...bold, fontSize: 18, lineHeight: 22, color: colors.ink },
  /** Big heading at the top of a screen, e.g. "Start your first kitty". */
  title: { ...bold, fontSize: 24, lineHeight: 30, color: colors.ink },
  /** Paragraph under a title. */
  body: { ...regular, fontSize: 16, lineHeight: 24, color: colors.text },
  /** Values and list rows. */
  bodyInk: { ...regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  bodyBold: { ...bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  /** Card titles, e.g. "Friday dinner". */
  cardTitle: { ...bold, fontSize: 18, lineHeight: 22, color: colors.ink },
  /** 14 pt copy: notes, step descriptions. */
  note: { ...regular, fontSize: 14, lineHeight: 21, color: colors.text },
  /** 14 pt values, e.g. "₹4,000 of ₹6,000". */
  meta: { ...regular, fontSize: 14, lineHeight: 21, color: colors.ink },
  /** 14 pt muted, e.g. "Fri 20 Nov, 4 days to go". */
  metaMuted: { ...regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  link: { ...regular, fontSize: 14, lineHeight: 21, color: colors.ink, textDecorationLine: 'underline' },
  /** Hints under inputs and the terms line. */
  small: { ...regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  /** Section and field labels, e.g. "COLLECTING NOW". */
  label: { ...bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: colors.text, textTransform: 'uppercase' },
  /** Badges, e.g. "MOMENT". */
  badge: { ...bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, color: colors.ink, textTransform: 'uppercase' },
  button: { ...bold, fontSize: 16, lineHeight: 20 },
  buttonSecondary: { ...regular, fontSize: 16, lineHeight: 20 },
  input: { ...regular, fontSize: 16, color: colors.ink },
  codeDigit: { ...bold, fontSize: 24, color: colors.ink },
} as const satisfies Record<string, TextStyle>;

/** Minimum touch target. */
export const TOUCH = 44;
