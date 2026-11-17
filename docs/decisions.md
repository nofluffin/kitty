# Decisions

Choices made during the build that aren't in the spec, or that settle something it leaves open. Newest first.

## 17 Nov 2026: step 3, organiser login and profile

- **Sign up asks for an email as well as the mobile number** while login uses email codes. The mobile number is still collected, because spec section 14 matches new organisers to earlier kitty members by phone. It isn't verified until SMS login is switched on.
- **Login method is one setting**, `EXPO_PUBLIC_LOGIN_METHOD` (`email` or `sms`). Screens change their wording ("Check your email" or "Check your messages") from the same setting.
- **Log in is its own screen** (not drawn in the wires). It never creates an account: an unknown email gets "There's no Kitty account for that email. Sign up instead."
- **Signing up with an email that already has an account just logs in.** The existing name and number are kept.
- **Codes last 10 minutes** (Supabase default is an hour), and a new code can be requested after 30 seconds.
- **A profile screen** (not drawn in the wires) is reached from the avatar on home: name, mobile number, UPI ID and log out. Account deletion comes with step 10.
- **Home shows real kitties already** (screen 1), since the seed data has them. Tapping a kitty or "Start a kitty" says which build step adds it.

## 17 Nov 2026: steps 1 and 2

**Decided with Raj**

- **Shares a paisa apart count as equal.** ₹1,000 across 3 (₹333.34, ₹333.33, ₹333.33) uses the screen 6 "equal" message, quoting the lower amount. Each member sees their exact amount on the link. (`shareMessage`, `isEqualSplit`)
- **The organiser's own share is confirmed automatically** when the kitty is shared. It counts towards "collected" and "x of y paid". Settle up never asks the organiser to top up or refund themselves. (`settleUp` returns `{ kind: 'organiser' }`)

**Engineering choices**

- **npm workspaces instead of pnpm.** npm ships with Node, so nothing extra to install. Turborepo runs tasks across workspaces.
- **Paise are `number` in TypeScript.** They're exact up to about ₹90 lakh crore and survive JSON. supabase-js returns `bigint` columns as numbers. Every core function checks for whole, safe integers.
- **The bill split rounds once, at the end.** Each person's exact share is worked out as a fraction across all lines, then rounded. Leftover paise go in sort order, and only to people whose share has a fraction. So nobody gets an extra paisa per line, and someone who owes ₹0 never gets one.
- **Goal parts must all fall on or after today.** If the organiser picks more parts than months remain, `goalParts` returns an error with the most parts that fit.
- **Goal share messages drop "so the bill is covered before we sit down"**, which only suits a dinner. The text is otherwise the spec's.
- **The database enforces the lock and status rules too**, with triggers, so a bug in either app can't change shares after sharing or move a payment backwards. Diet and drinks stay editable after sharing, for splitting the final bill.
- **New column `members.final_share_paise`** holds each member's share after settle up, so screens 17 and 18 can show "Your share" next to "You already paid".
- **Placeholder bundle ID `in.nofluff.kitty`** for iPhone and Android. Change it before the first EAS build if you want a different one: it can't change after store submission.
- **Local Supabase runs on ports 55321 to 55329**, because another local project uses the defaults.

## Gaps between the wires and the spec (to decide before the step that needs them)

| Where | Question | Needed by |
| --- | --- | --- |
| Screen 14 "My name is not here" | What happens? Ask the organiser, or let the member add themselves? Adding would break the share lock. | Step 5 |
| Screen 17 "Something looks wrong, tell Rohan" | Push to the organiser, or open WhatsApp to them? | Step 7 |
| Screen 17 "See the scanned bill" | Bill photos are private (spec 12). Show members the lines only, or the photo too? | Step 7 |
| Screen 18 "I've got the ₹600" | Spec has only the organiser marking refunds sent. Does the member's tap confirm it, or is it just a signal? | Step 7 |
| Spec 5, iPhone app links | `gpay://`, `phonepe://` and `paytmmp://` schemes in core are unverified. Test on real phones. | Step 5 |
| Spec 13, Sentry | Not wired yet: needs a Sentry account and DSN. | Before pilot |
