# Kitty colours

The palette for the organiser app and the member page. The code sources of truth are
`apps/mobile/src/ui/theme.ts` (`colors`) and `apps/web/src/app/globals.css` (`@theme`).
Change a colour in both places and here.

## Brand and actions (chosen by Raj)

| Name | Hex | Text on it | Used for |
| --- | --- | --- | --- |
| Action green | `#52A447` | White | Main action buttons: Create kitty, Add to kitty, Scan the bill, Confirm, Save, I've paid |
| Stone | `#9F9484` | Ink `#0A0A0A` | Selected options: Moment/Goal, Veg/Non-veg, Drinks, people chips, the chosen date, reminder switches |
| Red | `#ED2939` | White, or as text | Destructive actions: the “Archive this kitty” link (red text) |
| Moment orange | `#F38427` | White | The MOMENT tag on kitty cards (3px corners, small, near the top right corner) |
| Goal blue | `#4682B4` | White | The GOAL tag on kitty cards (same shape as MOMENT) |

## Neutrals (from the wireframes)

| Name | Hex | Used for |
| --- | --- | --- |
| Page | `#F6F4EE` | Screen background |
| Surface | `#FFFFFF` | Cards, header, inputs, secondary buttons |
| Sunken | `#EDEBE6` | You picture fill |
| Ink | `#0A0A0A` | Headings, values, text on stone |
| Text | `#3D3D3D` | Body copy and labels |
| Muted | `#6B6B6B` | Dates, hints, statuses |
| Line | `#7A7A7A` | Borders and dividers |
| Track | `#D4D4D4` | Empty part of progress bars, the non-veg bill tag |
| Error red | `#B42318` | Error messages (not buttons) |

## Notes

- White on action green is about 3:1 contrast, under the 4.5:1 guideline for 16 pt text. `#3E8A35` passes if that matters.
- White on moment orange is about 2.6:1: fine for a one-word tag, not for sentences.
- The bill-line tags keep the wire's code: veg white, non-veg grey, alcohol black. They're categories, not selections.
