# Decisions

Choices made during the build that aren't in the spec, or that settle something it leaves open. Newest first.

## 20 Nov 2026: push notifications, Activity and the footer

**Decided with Raj**

- **A footer with Kitties, Activity and You**, only on those three screens. Creating a kitty, scanning, settling up and a kitty's feed open on top without it.
- **Activity** (not in the wires) lists payments people say they've made across all kitties, with Confirm, then recent notifications. The Activity tab shows how many are waiting.

**How push works** (spec section 10)

- The database queues a notification when a member marks a payment as paid ("Kabir marked ₹1,000 as paid", with a "Confirm it arrived" button), and when the last payment is confirmed ("Everyone has paid for Friday dinner").
- A scheduled job at 9 am India time adds the reminders: the day before and on the pay by date when switched on (screen 23), and 3 days before each goal part. "Still to pay" leaves out people who said they've paid.
- Each notification is sent straight from the database to Expo's push service with pg_net. Expo's endpoint needs no key, so no secret is stored for this.
- The phone asks for permission the first time you open a shared kitty's feed, the moment "tell me when people pay" makes sense. Activity offers "Turn on notifications" if it's off. Logging out stops the phone getting them.
- Browsers (app.thekitty.app) don't get push; Activity still works there.

**Not done yet**

- iPhone push needs an Apple push key, created by `eas credentials` with your Apple login.
- Android push uses Firebase project `kitty-4d440`. Its `apps/mobile/google-services.json` is committed: it only identifies the app and isn't secret. The service account key that lets Expo send is uploaded to Expo by Raj and never stored in the repo.
- Tokens for phones that uninstalled Kitty aren't cleaned up yet; Expo just rejects those sends.

## 20 Nov 2026: picking contacts and adding people

- **Picking a contact fills in their mobile number.** The phone's main number is tried first, then the first Indian mobile among the rest. Kitty uses the contact picker that hands over just the picked person's details, so it still never needs access to the whole address book. Numbers with hidden formatting from phone contacts (direction marks, non-breaking spaces, 0091) are now read correctly. If none of their numbers is an Indian mobile, Kitty says so.
- **Screen 3 has a "Done, 4 people in" button** fixed at the bottom, and says "Aisha added" after each person, since it wasn't clear you go back a screen when you've finished (Raj, 20 Nov 2026).

## 20 Nov 2026: editing a kitty, and how shares are explained

**Decided with Raj**

- **A kitty is editable until someone pays,** not just until it's shared. Total, pay by date, people, shares, goal plan and UPI ID can all change while it's a draft, and after sharing until anyone other than the organiser marks or pays anything. After that, amounts lock and changes go through settle up. This replaces the spec's "locked once shared" rule (spec section 4).
- **Scanning the bill on a kitty nobody has paid yet replaces its total and shares** (screen 5), with no settle up. Once someone has paid, the scan goes through settle up as before.
- **The pay page also lists each dish** under its veg, non-veg or alcohol line, and **everyone's share** with the total, so the group can see the whole split (decided with Raj, 20 Nov 2026). A typed total can't be broken down by type: Kitty only knows that from a scanned bill.
- **The member pay page explains the share** under "How your share was worked out": the scanned split by veg, non-veg and alcohol with "See the scanned bill", or for a typed total "Total ₹4,500, split 3 ways", including amounts the organiser set by hand.

**How it works**

- Edit opens the screen 2 form, filled in, from the share screen ("Edit the kitty") or the feed ("Nobody has paid yet. Edit the amounts or people"). "Save changes" keeps the same link: members see the new amounts straight away, and their picked names stay.
- `update_kitty` in the database redoes everyone's payment requests from the new shares. The lock triggers now start at the first payment, so the database enforces the same rule.

## 20 Nov 2026: step 9, goal kitties (screen 22)

**Decided with Raj**

- **Goals are in v1.** Launch on Android and iPhone together.

**How it works** (only screen 22 is drawn, so the rest follows the moment screens)

- **Screen 22** switches the labels to "What are you saving for" and "Target", hides "Scan the bill", and adds "How people pay": one payment or in parts.
- **Number of parts** isn't in the wires. Kitty offers 2 up to as many monthly parts as fit before the pay by date (a year at most), and starts at 3, or fewer if fewer fit. The last part falls on the pay by date, one a month before it; the first can be today.
- **Each part is its own payment.** Members pay one part at a time: the member page asks for "part 2 of 4, ₹1,250, due Sun 20 Dec" and lists every part with how it stands. "I've paid" and the organiser's "Yes, it arrived" act on that part only, so later parts stay open.
- **The feed shows "1 of 4 parts paid. Next ₹1,250 by Sun 20 Dec"**, and Nudge asks for the next part: "Hi Aisha, part 2 of 4 for Goa trip (₹1,250) is due Sun 20 Dec. It takes a minute to pay: [link]". Someone counts as paid once every part is confirmed.
- **Share message for parts** (not worded in the spec): "Goa trip is ₹5,000 each, paid in 4 monthly parts. The first is due Fri 20 Nov, the last Sat 20 Feb. [link]".
- **After the trip, "Enter the final cost"** replaces "Scan the bill" in a goal's feed and uses the typed settle up from step 7. Parts not yet paid are written off and replaced by the top-up or refund, as with shares.
- The database works out the parts when the kitty is shared, with the same rule as `goalParts` in packages/core, and refuses a plan whose first part would fall before today.

**Not done yet**

- The push reminder 3 days before each part is due (spec section 10) comes with push notifications.

## 20 Nov 2026: paying by QR code first

- **Raj's real-phone test (iPhone, ₹1 to a personal UPI ID):** the pay button failed in GPay, PhonePe and Paytm with "you've exceeded the bank limit for this payment". Scanning the QR code with the same details worked. Developers report the same block for payment links to personal UPI IDs, so it isn't the amount or Kitty's link.
- **Screens 15 and 17 now lead with the QR code,** with steps for paying from the same phone: screenshot it or press and hold to save it, then scan it from photos in the UPI app. "Copy UPI ID" sits under it.
- **"Open a UPI app" stays as a secondary button,** with a line saying some apps block it. It may still work on Android or with other banks; not tested yet.
- **"I've paid" is now the main button,** since there's no longer a return from the UPI app to prompt it.

## 20 Nov 2026: step 8, bill scan (screens 5, 9, 10, 11, 25)

**How it works**

- **The scan runs in a Supabase Edge Function, `scan-bill`,** so the Anthropic key never reaches a phone. It checks the caller's login, acts as them (RLS applies, so nobody can scan into someone else's kitty), downloads up to 3 photos from the private `bill-photos` bucket and asks Claude for the lines as structured JSON.
- **Model: Claude Opus 5.5 (`claude-opus-5-5`)** at medium effort, with server-side fallbacks on, so a busy model doesn't fail the scan. A real test bill (7 lines, ₹5,954) read correctly in 7 seconds for about $0.023.
- **Every scan logs its model, tokens and estimated cost** on the bill (`bills.scan_cost_usd`), so cost per kitty can be added up.
- **Lines under 70% confidence are "unsure"** and go to screen 10 first. Nothing can be split while a line is unsure; the database refuses too.
- **The printed total is checked** against the lines plus extras (tax, service). Over ₹1 out either way, screen 11 says so, since a line was probably missed or misread.
- **Bill status:** processing → needs review (screens 10 and 11) → confirmed ("Looks right, work out shares"), or failed (screen 25).
- **Photos:** the phone's own camera, not a live camera view inside Kitty. Photos are shrunk to 1600px JPEG before upload. On the web preview only "Choose from gallery" shows.
- **Scanning before sharing** ("Have the bill already? Scan it", screen 2) saves the kitty as a draft with no total first, so the photos have a home. A kitty with no total can't be shared. Screen 5's "Done" sets the total and every share from the bill in one database call (`apply_scanned_shares`).
- **Screen 5 amounts are read-only.** To change who had what, the organiser goes back to the bill lines, so the shares always add up to the bill.
- **Scanning the final bill** (from the feed) leads straight into settle up (screen 12) with the scanned shares.
- **Members see the breakdown by category** on screens 17 and 18 ("Veg dishes, split 6 ways ₹400", "Alcohol: Not charged"). **"See the scanned bill" shows the lines and total, not the photo,** since bill photos stay private (spec 12). Change this if you'd rather members see the photo.
- **If nobody is marked as drinking but the bill has alcohol** (or the same for non-veg), screen 11 asks the organiser to tick who had it before splitting.

**Not done yet**

- The scan function, its migration and the Anthropic key are not in production yet.

## 20 Nov 2026: step 7, settle up (screens 12, 13, 17, 18)

**Decided with Raj**

- **Typed final bill:** amounts the organiser typed by hand stay as they were; the rest of the final bill is split equally among everyone else (the screen 4 rule), not a plain equal split.
- **Unconfirmed payments are confirmed first.** Settle up won't start while anyone's "I've paid" is waiting, so top-ups and refunds come from money that really arrived.
- **A refund is finished by either side:** the organiser's "Mark sent" or the member's "I've got the ₹600", whichever comes first.

**How it works**

- `settle_kitty` and `close_kitty` are single database calls. The shares come from `typedBillShares` in packages/core; the database checks they add up to the bill.
- Settling writes off what's still owed on the original shares and replaces it with each person's difference, so someone who never paid owes their whole new share (spec section 4). Written-off amounts stay on record.
- "Scan the bill" in the feed goes to a "Final bill" screen for typing the total until the bill scan (step 8) puts the camera in front of it. That screen isn't in the wires.
- Screen 12 leads with refunds; screen 13 (someone never paid) leads with money still to come in, as drawn.
- **Ask** opens WhatsApp with a top-up message. Its wording isn't in the spec: "Hi Kabir, Friday dinner came to a bit more. Your share is ₹1,250 and you paid ₹1,000, so it's ₹250 more: [link]". Someone who never paid gets the usual nudge.
- People owed a refund can still pick their name on the member page ("Money back"), so they can claim it from a new phone.
- Screens 17 and 18 explain a typed bill as "Final bill ₹5,000, split 5 ways". The veg, non-veg and alcohol breakdown and "See the scanned bill" come with step 8.

## 20 Nov 2026: production domain and login emails

- **Domain: `thekitty.app`**, bought by Raj at GoDaddy, with DNS moved to Vercel. The member page is served at `https://thekitty.app`, and `www` forwards there.
- **Login emails go through Resend** from `login@mail.thekitty.app`, as "Kitty". The Resend DNS records were added to Vercel DNS by Resend's own "Connect" flow.
- **Production auth settings live in `supabase/config.toml` under `[remotes.production]`**, so local values (localhost addresses, one-second email gaps, two emails an hour) never reach production. Always run `supabase config diff` before `supabase config push`, and set `RESEND_API_KEY` from the keychain item "Kitty Resend API key" for the push.
- **Production login:** 6-digit codes valid for 10 minutes, one code a minute per email, 60 emails an hour across the project.
- **Not yet done:** the organiser app still points at the local database. Pointing a phone build at production comes with the development build (push notifications, step 6).

## 20 Nov 2026: step 6, the kitty feed (screens 7, 8, 23)

- **Feed order:** people who said they paid, then "not received", then unpaid, then you, then everyone who's paid.
- **Confirm also covers cash.** The nudge screen has "Zoya paid you another way? Confirm ₹1,000", since the feed only shows Nudge for people who haven't marked paid.
- **"Not yet"** sets the payment to "not received", which shows the member screen 26. Their UPI reference, if they send one, shows on the confirm screen.
- **"Open my UPI app to check" (screen 8) is left out.** No standard link opens a UPI app just to view history; the generic `upi://` link starts a new payment. The screen tells the organiser to check their UPI app instead.
- **Group reminder wording isn't in the spec.** Kitty uses: "Quick reminder for Friday dinner: if you haven't paid your share yet, it takes a minute: [link]". Change it in `groupReminderMessage` if you'd like different words.
- **Tapping a shared kitty on home opens its feed.** Drafts still open their share screen.
- **Reminder switches save now.** The reminders themselves are push notifications, the last part of step 6.

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
- **App ID `app.thekitty.organiser`** for iPhone and Android (decided with Raj, 20 Nov 2026). `app.thekitty` was taken by another Apple developer. It can't change after the first store submission.
- **Local Supabase runs on ports 55321 to 55329**, because another local project uses the defaults.

## Gaps between the wires and the spec (to decide before the step that needs them)

| Where | Question | Needed by |
| --- | --- | --- |
| Screen 14 "My name is not here" | What happens? Ask the organiser, or let the member add themselves? Adding would break the share lock. | Step 5 |
| Screen 17 "Something looks wrong, tell Rohan" | Push to the organiser, or open WhatsApp to them? | Step 7 |
| Screen 17 "See the scanned bill" | Bill photos are private (spec 12). Lines only for now (step 8). Should members see the photo too? | Before pilot |
| Screen 18 "I've got the ₹600" | Spec has only the organiser marking refunds sent. Does the member's tap confirm it, or is it just a signal? | Step 7 |
| Spec 5, iPhone app links | `gpay://`, `phonepe://` and `paytmmp://` schemes in core are unverified. Test on real phones. | Step 5 |
| Spec 13, Sentry | Not wired yet: needs a Sentry account and DSN. | Before pilot |
