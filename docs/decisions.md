# Decisions

Choices made during the build that aren't in the spec, or that settle something it leaves open. Newest first.

## 19 Nov 2026: step 5, the member pay page

**Decided with Raj**

- **"My name is not here" asks the organiser.** It shows "Only Rohan can add people to this kitty" and a button that opens WhatsApp to the organiser (when they have a number). Members can't add themselves, so amounts stay locked.
- **Step 5 before step 6**, as in the spec.

**How it works**

- **The browser never talks to Supabase** (spec section 7). Next.js server code reads and writes with the service key, which only exists on the server.
- **Picking a name sets an httpOnly cookie** for that link only, kept for a year. Page scripts can't read it. If the name was already picked on another phone, the page asks "Is this you, Zoya?" first.
- **"Not you? Pick another name"** (and the back arrow on screen 15) forgets the name on this browser.
- **The organiser isn't in the "Who are you?" list**, as in the wires. Names go unpaid first, then waiting, then paid (greyed out, not tappable).
- **Drafts look like a missing link**, so an unshared kitty doesn't leak.
- **"Did the payment go through?"** appears when the member comes back to the page after tapping the pay button. "I've paid" is always there too.
- **UPI references must be 12 digits.** Sending one moves the payment back to "waiting" for the organiser.
- **On iPhone, GPay, PhonePe and Paytm buttons** appear under the main pay button. Their link formats are unverified (see below).
- **"Get Kitty" links to the site's home page** until the app is in the stores.

**Not done yet**

| What | When |
| --- | --- |
| Test the pay button on real phones with GPay, PhonePe and Paytm, Android and iPhone. The spec says step 5 isn't done until this passes. | Before merging step 5 |
| The live Vercel site has no database yet, so member links there show "No connection". Needs a Supabase cloud project in Mumbai and its keys in Vercel. | Before sharing real links |
| Rate limiting on member links (spec section 12). | Before the pilot |
| Push notification to the organiser when someone marks paid. | Step 6 |
| Top-up and refund screens (17, 18). | Step 7 |

## 19 Nov 2026: step 4, creating and sharing a moment kitty

- **Saving and sharing are database functions** (`create_kitty`, `share_kitty`), so a kitty is never half-saved. Both check that shares add up to the total to the paisa. The database tests cover them.
- **Share on WhatsApp or Copy link locks the amounts**, whichever is tapped first (spec section 4). Sharing twice is safe.
- **Share on WhatsApp opens WhatsApp's own chat picker** (`wa.me/?text=`), so the organiser can pick the group. If WhatsApp isn't installed, the phone's share sheet opens instead.
- **A kitty needs at least one person besides the organiser**, and the pay-by date can't be in the past.
- **The organiser starts as veg and doesn't drink**, like everyone else. They can change that, remove themselves ("I'm not paying into this one", e.g. for a gift) and add themselves back.
- **Typing a share on screen 4 fixes it**; clearing the box unfixes it. Retyping the amount Kitty already worked out doesn't fix it.
- **"Skip for now" leaves a draft.** Tapping a draft on home reopens its share screen.
- **Goal and Scan the bill** show which build step adds them (9 and 8).

**Open questions from step 4**

| Question | Why it matters |
| --- | --- |
| Can a draft's people and amounts be edited after "Create kitty"? Right now they can't: create again instead. | Spec allows changes while `status = draft`. Needs an edit flow. |
| The equal-share message always says "so the bill is covered before we sit down", as in spec section 9. Fine for a cab or tickets? | It reads oddly for non-dinner moments. Could drop it, or vary it. |
| Android may declare the contacts permission even though Kitty only uses the picker. | Spec section 12 says never read the whole address book. Check on a real Android phone before store submission. |

## 17 Nov 2026: matching the wireframes

- **All sizes, spacing and colours come from the wireframe PDF.** The wires are drawn on a 390 x 844 pt phone at 0.6 scale. Every value is in `apps/mobile/src/ui/theme.ts`, with the measurements behind it.
- **The wires use Adrianna (Chank Co.) for all text.** It's a paid font and isn't licensed yet. **DM Sans stands in** because it was the closest free match by text width (within about 3%). To switch: buy an app and web licence for Adrianna Regular and Bold, add the files, load them in `apps/mobile/src/app/_layout.tsx` and change the two names under `fonts` in `theme.ts`.
- **"You" in the avatar**, as drawn, instead of initials.

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
