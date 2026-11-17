# Kitty v1 build spec

Status: draft for build, November 2026. Owner: Raj.

## 1. What v1 does

An organiser creates a kitty for a moment (dinner, a cab, tickets) or a goal (a trip, a gift). Kitty works out each person's share. The organiser shares a link on WhatsApp. Each member opens the link in a browser, picks their name and pays their share to the organiser's UPI ID from their own UPI app. The organiser confirms each payment. After the event the organiser can enter or scan the final bill, and Kitty works out top-ups and refunds.

Kitty never holds or moves money. It cannot see payments. The organiser is the source of truth for whether money arrived.

Success is measured by two numbers: kitties fully paid before their date each week, and new organisers who first used Kitty as a member.

## 2. Surfaces

| Surface | Who | Built with | Hosted |
| --- | --- | --- | --- |
| Organiser app | People who create kitties | React Native, Expo, TypeScript | App Store and Google Play via Expo EAS |
| Member pay page | Everyone in a kitty | Next.js, TypeScript | Vercel |
| Backend | Both | Supabase: Postgres, auth, storage, edge functions | Supabase, Mumbai region |

Members never install anything. The organiser app is native so contact picking, the camera and push notifications work on Android and iPhone.

## 3. Data model

All money columns are `bigint` paise. All tables have `id uuid`, `created_at`, `updated_at`.

**profiles** (one per organiser, linked to `auth.users`)
- `name`, `phone`, `upi_id` (last used, prefilled on new kitties)

**kitties**
- `organiser_id`
- `kind`: `moment` | `goal`
- `title`, `due_date`
- `total_paise`
- `upi_id`: snapshot of the organiser's UPI ID for this kitty
- `amount_source`: `typed` | `scanned`
- `goal_plan`: `single` | `parts` (goals only), `parts_count`
- `status`: `draft` | `shared` | `settling` | `closed` | `cancelled`
- `share_slug`: random, at least 12 characters, used in the member link
- `shared_at`, `closed_at`
- `final_bill_paise`: set at settle up
- `remind_day_before`, `remind_on_day`: booleans for organiser reminders

**members**
- `kitty_id`, `name`, `phone` (optional, from contacts), `is_organiser`
- `diet`: `veg` | `nonveg`
- `drinks`: boolean
- `share_paise`: what they are asked for
- `share_fixed`: true if the organiser typed this amount by hand
- `refund_upi_id`: optional, entered by the member
- `last_opened_at`
- `sort_order`

The organiser is a member of their own kitty by default (`is_organiser = true`) and can remove themselves, for example when organising a gift they are not paying into.

**payments**
- `kitty_id`, `member_id`
- `kind`: `share` | `topup` | `refund` | `part`
- `direction`: `in` (member to organiser) | `out` (organiser to member)
- `amount_paise`, `due_date` (for goal parts)
- `status`: `requested` | `marked` | `confirmed` | `not_received` | `written_off`
- `marked_at`, `confirmed_at`, `upi_ref` (optional, typed by the member)

**bills**
- `kitty_id`, `image_paths` (one or more photos)
- `status`: `processing` | `needs_review` | `confirmed` | `failed`
- `total_paise`, `extras_paise` (tax, service charge, minus discounts)
- `raw_result` (JSON from the scan)

**bill_lines**
- `bill_id`, `raw_text`, `label`, `amount_paise`
- `category`: `veg` | `nonveg` | `alcohol` | `unsure`
- `confidence` (0 to 1), `added_by_hand`

**member_claims**
- `member_id`, `claim_token` (random, stored in a cookie on the member's browser), `claimed_at`

**device_tokens**
- `profile_id`, `expo_push_token`, `platform`

## 4. Money rules

All of this lives in `packages/core` with unit tests for every case below.

**Exact amounts.** Every share, top-up and refund is the exact amount owed, to the paisa. Nothing is rounded to rupees or tens, and Kitty adds nothing. Amounts are shown with paise when there are any (₹1,031.67) and without when there aren't (₹1,000). The only leftover is when a split doesn't divide into whole paise, for example ₹1,000 across 3 people. Give the extra paise one at a time to members in sort order (₹333.34, ₹333.33, ₹333.33), so the shares always add up to the total exactly.

**Equal split.** `share = total / number of members`, then the exact amounts rule.

**Adjust one person (screen 4).** When the organiser types an amount for a member, that member becomes `share_fixed`. The rest of the total is split equally across members who are not fixed. If fixed amounts add up to more than the total, show an error and don't save. "Reset to an equal split" clears every fixed flag.

**Split from a scanned bill (screens 5 and 11).**
1. Spread `extras_paise` across lines in proportion to each line's amount.
2. Veg lines are shared by all members. Non-veg lines by members with `diet = nonveg`. Alcohol lines by members with `drinks = true`.
3. Each person's share is the sum of their part of each line, using the exact amounts rule for any paise left over.
4. If a category has lines but nobody eligible (an alcohol line but nobody marked as drinking), block and ask the organiser to either mark who had it or move the line to shared.
5. Lines still marked `unsure` block the split until the organiser picks a category (screen 10).

**Lock.** Amounts and members can change while `status = draft`. Sharing the link sets `status = shared` and locks `share_paise`. After that, amounts only change through settle up.

**Settle up (screens 12 and 13).**
1. The organiser enters the final bill by hand or scans it. Status becomes `settling`.
2. Kitty works out a new share per member: equal split for a typed total, the scan split for a scanned bill.
3. For each member: `difference = new share - confirmed amount paid`. Positive means a top-up request. Negative means a refund. A member who paid nothing owes the full new share.
4. The organiser marks refunds as sent. Members mark top-ups as paid, and the organiser confirms, as with shares.
5. The kitty closes when every difference is settled, or when the organiser closes it and writes off what's left. Written-off amounts are stored, not deleted.

If the bill was scanned before sharing (screen 5), shares already match the bill, so settle up has nothing to do unless the organiser changes something.

**Goals paid in parts.** Each member's share is split into `parts_count` equal monthly parts, the last falling on or before `due_date`, with any leftover paise on the last part. Each part is its own payment row.

## 5. Paying and confirming

**Pay link.** The member page builds a UPI URI with `packages/core`:

```
upi://pay?pa=<organiser UPI ID>&pn=<organiser name>&am=<amount in rupees, 2 decimals>&cu=INR&tn=<short note, e.g. "Kitty Friday dinner">
```

- "Pay with a UPI app" opens this URI. On Android the system shows a list of UPI apps.
- On iPhone a generic `upi://` link is unreliable, so also show buttons for the main apps using their own schemes. Test before relying on any of them.
- Show a QR code of the same URI and a "Copy UPI ID" button as fallbacks.
- This behaviour must be tested on real phones with GPay, PhonePe and Paytm before the member page is considered done.

**Marking paid.** When the member comes back to the page after opening the UPI app, ask "Did the payment go through?". Yes marks the payment `marked` and sends the organiser a push notification. The "I've paid" button does the same if they come back another way.

**Confirming (screen 8).** The organiser taps "Yes, it arrived" (`confirmed`) or "Not yet" (`not_received`). Not yet shows the member screen 26, where they can pay again or type a UPI reference number for the organiser.

Kitty never checks bank data. No SMS reading in v1.

## 6. Screens

Numbers match the wires. Organiser screens are in the app. Member screens are on the web page.

**Getting started (organiser)**
- 19 Sign up: name and mobile number.
- 20 Enter the code: 6 digit code.
- 21 Home with no kitties: three steps and "Start a kitty".

**Creating a kitty (organiser)**
- 1 Home: kitties collecting now, then done ones.
- 2 New kitty: moment or goal, name, total, pay by date, people, split summary, UPI ID. "Have the bill already? Scan it for exact shares" goes to screen 9.
- 22 New goal kitty: as screen 2 plus one payment or in parts.
- 3 Add a person: pick from contacts or type a name, optional number, veg or non-veg, drinks or doesn't drink.
- 4 Adjust shares: per-person amounts using the adjust rule.
- 5 Shares from a scanned bill: amounts filled from the scan, still editable before sharing.
- 6 Share: message preview, share on WhatsApp, copy link.
- 24 Share when amounts differ: the message says "pay your share" without an amount.

**Collecting (organiser)**
- 7 Feed: total collected, progress, one row per member. Rows needing action first (marked paid, then unpaid). Confirm and Nudge buttons. "Scan the bill" to settle up.
- 8 Confirm a payment.
- 23 Nudge: message preview, send to one person or post in the group, organiser reminder switches.

**Bill scan (organiser)**
- 9 Take the photo: camera, gallery, or enter the total by hand. Multiple photos for long bills.
- 10 Sort the unsure lines: name and category for each unsure line. Continue is blocked until each has a category. "Add a line Kitty missed".
- 11 Check the lines: every line with its tag, tap to change. Category totals and per-person amounts.
- 25 Scan failed: retake, enter the total by hand, or type the lines in.

**Settling (organiser)**
- 12 Settle up: refunds to send and top-ups to ask for, each with its own action. Close the kitty.
- 13 Settle up with someone unpaid: adds "Still to come in" and what the organiser is covering. Close and write off.

**Member web page**
- 14 Open the link: kitty summary, pick your name. Names already paid are disabled.
- 15 Pay your share: amount, UPI button, QR and copy fallbacks, "I've paid".
- 16 Paid, waiting: everyone's status and a "Get Kitty" prompt.
- 17 Top-up after the bill: amount, how the share was worked out, pay.
- 18 Refund after the bill: amount, breakdown, field for the member's UPI ID.
- 26 Payment not received: pay again or send the UPI reference.
- 27 Link closed: also covers link not found, kitty cancelled and no connection.

States every screen needs: loading, empty, offline, and an error with a way to retry.

## 7. Member identity on the web page

Members have no login. Picking a name creates a `member_claims` row and sets a cookie on that browser. Next time they open the link they go straight to their own screen.

If a name is already claimed on another browser, ask "Is this you?" and let them continue. Claiming is a convenience, not security. The organiser still confirms every payment, so a wrong claim can't move money.

The page reads and writes through Next.js server routes using the share slug and claim token. The browser never queries Supabase tables directly. Members see names and paid status for everyone, and only their own amounts breakdown and refund details.

## 8. Bill scan

- The app uploads photos to a private storage bucket and calls a Supabase edge function.
- The function sends the images to the Claude API with a prompt that returns JSON only: each line's raw text, a cleaned label, amount, category (`veg`, `nonveg`, `alcohol`, or `unsure`) and confidence, plus subtotal, extras and total.
- Validate the result. Lines plus extras must equal the printed total within ₹1. If not, mark the bill `needs_review` and show the mismatch on screen 11.
- Lines with confidence under 0.7 become `unsure` and go to screen 10.
- If nothing usable comes back, mark the bill `failed` and show screen 25.
- Treat soft drinks, water, desserts and bread as veg unless they clearly contain meat, fish or egg. Egg dishes count as non-veg.
- Log the cost of each scan call so we can see it per kitty.

## 9. Messages and sharing

Kitty sends no WhatsApp messages itself in v1. All messages to members go from the organiser's own WhatsApp.

- To one person with a number: open `https://wa.me/<number>?text=<message>`.
- To the group or someone without a number: the phone's share sheet with the message and link.

Default message text (the organiser can edit before sending):

- Share, equal amounts: "Friday dinner is ₹1,000 each. Pay your share by Fri 20 Nov so the bill is covered before we sit down. [link]"
- Share, different amounts: "Friday dinner came to ₹5,400. Open the link, pick your name and pay your share: [link]"
- Nudge: "Hi Zoya, ₹1,000 for Friday dinner is still open. It takes a minute to pay: [link]"

## 10. Notifications

Expo push notifications to the organiser only:

- A member marked a payment as paid (with a Confirm action).
- Everyone has paid.
- Reminder the day before and on the day, if switched on, listing who hasn't paid.
- A goal part is due in 3 days, listing who hasn't paid it.

## 11. Login

- Organisers log in with their mobile number and a one-time code through Supabase auth with an SMS provider.
- SMS to Indian numbers needs DLT registration of the sender ID and message template. Until that is approved, use email login with a code through Supabase, with Resend as the email sender. Build login so the method can be switched by configuration.
- Members never log in.

## 12. Privacy and security

- Row level security on every table. An organiser can read and change only their own kitties and everything under them.
- The service role key is used only in Next.js server routes and edge functions.
- Share slugs are random and long enough that they can't be guessed. Rate limit the public routes.
- Contacts: use the system contact picker, which returns only the people the organiser selects. Never read or upload the whole address book.
- Store only what the flow needs: names, optional numbers, UPI IDs, diet and drinks flags, bill photos.
- Bill photos are private. Delete them 90 days after a kitty closes.
- Organisers can delete their account and all their kitties.
- Write a privacy policy that covers all of the above before store submission. Have it checked against India's DPDP Act.

## 13. Tools and environments

- Local: Supabase running in Docker Desktop, seeded with sample kitties. Expo on a real phone. Next.js locally.
- Code: GitHub, one pull request per feature, tests run on every pull request.
- Hosting: Vercel for `apps/web` with preview deployments per pull request. Supabase cloud project in the Mumbai region, with separate staging and production projects.
- Builds: Expo EAS for Android and iPhone.
- Errors: Sentry in the app, the web page and edge functions.
- Email: Resend, for login codes in the pilot.

Secrets, never committed:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ANTHROPIC_API_KEY` (scan function only), `RESEND_API_KEY`, SMS provider keys, `SENTRY_DSN`, Expo access token.

## 14. Measuring success

Record these events with the kitty id and a timestamp:

`organiser_signed_up`, `kitty_created`, `kitty_shared`, `member_opened_link`, `member_claimed_name`, `payment_marked`, `payment_confirmed`, `kitty_fully_paid` (with whether it was before `due_date`), `bill_scanned`, `kitty_closed`.

When a new organiser signs up, check whether their phone number matches a member in an earlier kitty. If it does, record them as having joined through an invite.

## 15. Build order

Each step ends with something that works end to end and is tested.

1. Repo, workspaces, local Supabase, CI, Sentry.
2. `packages/core`: types, all split rules, exact amounts, UPI URI builder, with tests.
3. Organiser login and profile.
4. Create a moment kitty: people, contacts, equal and adjusted shares, share link.
5. Member web page: open, claim a name, pay, mark paid, waiting, closed states. Test the pay link on real phones here.
6. Feed, confirm, not received, nudge, push notifications.
7. Settle up with a typed final bill: top-ups, refunds, unpaid members, close and write off.
8. Bill scan: both paths, unsure lines, failed scan.
9. Goal kitties, single and in parts.
10. Pilot readiness: events, privacy policy, store listings, account deletion, submission.

## 16. Not in v1

Wallet or pooled account, paying a vendor from Kitty, holding leftovers, Kitty sending WhatsApp messages, reading SMS, payment gateways, Paddle or in-app purchases, teen accounts, cards, rewards, budgeting, spending insights.

## 17. Open decisions

- Goal kitties: in v1, or wait for the wallet? Holding friends' money for weeks in one person's account is a bigger ask than holding it for one evening.
- Launch Android and iPhone together, or Android first?
- Login at pilot: wait for DLT and use SMS, or start with email codes?
- How each UPI app behaves with the pay link on Android and iPhone. Test before step 5 is signed off.
