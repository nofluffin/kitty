# Decisions

Choices made during the build that aren't in the spec, or that settle something it leaves open. Newest first.

## 22 Nov 2026: group rows open the group

- **The Groups list has no Share or Edit buttons** (Raj). Each row is the star, the group's name and people (now using the full width), and an arrow; tapping it opens the group.
- **Share on WhatsApp is on the group's own screen**, above Save group. It shares the group as saved (`shareGroup` in apps/mobile/src/lib/groups.ts).

## 22 Nov 2026: name placeholder and saving groups

- **Name fields say "Firstname Lastname"** as the example, instead of "Aisha" (Raj).
- **"Save these people as a group" on a kitty's People screen shows only once someone new has been added** (Raj). On New kitty everyone is new, so it shows as before.
- **Saving the same people as an existing group shows "This group already exists"** and names that group, instead of saving it again. People are compared by mobile number, or by name without one, leaving yourself out (`findSameGroup` in apps/mobile/src/lib/groups.ts).

## 22 Nov 2026: renaming someone in a group

- **Renaming someone in a group also renames them in your other groups and in your kitties where nobody has paid yet** (Raj chose this over groups only, or everywhere). Kitties someone has paid into keep the old name as a record.
- **People are copies, so the same person is matched by mobile number**, or by their old name (ignoring case) when neither copy has a number. Your own row is never renamed.
- **Groups someone else also holds aren't changed**, keeping the rule that a group never changes for anyone else.
- `public.rename_people` (migration 20261122124052) does it; the app calls it after Save group with everyone whose name changed.

## 22 Nov 2026: people lists with pills

- **Lists of people (a kitty's People screen and a group) show each person's food and drink as pills under their name**, with an arrow at the end of the row to show it opens them (Raj). The pills are shared with the person page (apps/mobile/src/ui/diet-tags.tsx).
- **On the add-a-person form, the mobile number comes straight after the name**, before "Who pays for them".

## 22 Nov 2026: editing a kitty in three parts

- **Edit kitty is split into Details, People and Amounts** (Raj: the one screen did too much for newcomers). The kitty page and share screen show three rows under "Nobody has paid yet, so you can still edit". Details (the old screen, opened with ?edit=) holds the name, total, pay by date, UPI ID and a goal's plan; People is the add-a-person screen; Amounts is the Adjust shares screen. Each has its own Save changes, which saves the whole kitty through `useSaveEdit` (apps/mobile/src/lib/save-edit.ts) and goes back.
- **Details is titled "Edit {kitty name}"**, using the name as saved, so it doesn't change while it's retyped.
- **The kind (Moment or Goal) can't change once saved**, and "Save and scan the bill" is gone from editing: the kitty page already has Scan the bill.
- **Amounts is greyed out until there's an amount.** If a smaller total no longer covers amounts set by hand, Details says to change them under Amounts first.

## 22 Nov 2026: Upload bill after taking the photo

- **Once a photo of the bill is taken, the main button says "Upload bill"** (Raj), or "Upload bill (2 photos)" for more than one. It said "Scan this photo", which read like taking another picture. "Rescan the bill" on the kitty page and share screen stays as it was (the earlier change to "Upload bill" there was reverted).

## 22 Nov 2026: Vercel builds main only

- **Both Vercel projects deploy only from main** (Raj): `git.deploymentEnabled` in apps/web/vercel.json and apps/mobile/vercel.json, so pull request branches no longer make preview builds. On 21 Nov the Hobby plan's daily deployment limit was hit (each PR made previews of both sites plus the live builds), which held thekitty.app and app.thekitty.app back for about a day. Check changes locally or in the browser tests before merging instead.

## 22 Nov 2026: kitties without an amount or date

- **A kitty can be saved with no amount and no pay by date** (Raj). The button says "Save kitty" instead of "Create kitty", and everyone's share is ₹0. It's kept as a draft: on Kitties it shows "No amount yet" and "No pay by date yet", and opening it explains what's missing, with Scan the bill and Edit kitty.
- **It can be shared once both are in** (Raj chose this over sharing a ₹0 kitty). The database enforces it: share_kitty asks for a total and a date, and a shared kitty can't lose its date (constraint kitties_shared_have_a_date) or its total.
- A goal can also wait for its target. Paying a goal in parts still needs a date, since the parts count back from it.
- Migration 20261122030122_kitty_without_amount.

## 21 Nov 2026: Save and scan on Edit kitty

- **Edit kitty has a "Save and scan the bill" button above Save changes** (Raj), for moments. It saves your edits, then opens the camera. The dashed scan box is gone from Edit kitty; New kitty keeps it, worded "Have the bill? Scan it for exact shares" so it no longer gets cut off.

## 21 Nov 2026: coloured food and drink pills

- **The food and drink pills are coloured** (Raj): Veg green `#52A447`, Non-Veg red `#ED2939`, both with white text; Alcohol black with white text; No Alcohol stone `#9F9484` with white text (Raj changed it from white the same day). Their text is a size smaller (11 pt) so they don't look tight. Same on the person screen in the app and on the member page, which now shows No Alcohol too.

## 21 Nov 2026: the Help tab is now Kitty

- **The Help tab is called "Kitty", with an info icon** (Raj). Its header says Kitty too. It opens with Why Kitty, then the how-to topics.
- Phone login is on hold (Raj, 21 Nov): WhatsApp codes cost roughly ₹0.55 to ₹0.60 each with Twilio; revisit later.

## 21 Nov 2026: Why Kitty, confirmation messages and motion

- **Why Kitty** (Raj): five short points on what Kitty saves you from (only you need the app, money comes straight to you, fair splits, no chasing, set up once). It sits at the top of Help, and under the steps on an empty Kitties tab. It only claims what the app does.
- **A short message after an action**, just under the header for about 2.6 seconds, so it never covers a footer button or the tab bar: group added, saved, left or deleted; saved as a group; kitty archived or back on your list; changes saved; someone marked as paid or asked to check; kitty settled. Screen readers announce it.
- **Motion, following Raj's motion rules** (src/ui/motion.ts): opening eases in at 220 ms, closing eases out faster at 170 ms; only opacity and transform move; nothing bounces. Cards and rows rise 4 pt as they arrive; Help answers fade in and the topics below ease into place; progress bars fill from the left; buttons fade slightly while held; messages drop in and leave the way they came. Reduce Motion on the phone skips all of it.
- **On the web, entering and exiting animations are off**: Reanimated 4.7 left those elements hidden in the browser. Progress bars and button fades still animate there.
- The shared-group page now says the group is in the Groups tab (it said Your details).

## 21 Nov 2026: every page starts and ends in the same place

- **Content starts 24 pt under the header and the footer button sits 20 pt above the tab bar or the bottom edge, on every page** (Raj: Start a kitty sat higher than New group, and Collecting now sat lower than Recent). The spacing lives in one place, `page` in theme.ts, used by the Screen component, the four tabs and the kitty page.
- Titles now carry their 6 pt gap below them instead of above, so a page that opens with a title or paragraph starts at the same height as the rest. A page that opens with a field (editing a person) does the same.

## 21 Nov 2026: Help topics indented

- **In Help, the topic text and the + sit 10 pt in from each side** (Raj); the dividing lines stay full width. Answers are indented to match, and so are the Privacy and contact text and links.

## 21 Nov 2026: group wording on the people screen

- **In a group, the people screen says "In this group" and "Remove from group"** (and "Leave me out of this group" on your own row), not kitty (Raj). Kitties keep their wording.

## 21 Nov 2026: group name on the people screen

- **Adding or editing people in a group shows the group's name at the top, read only** (Raj). It's changed on the group screen. (Briefly editable on 21 Nov; Raj then asked for it read only.)

## 21 Nov 2026: who pays waits for a name

- **The "Who pays for them" pills are greyed out until the name is filled in** (Raj), with the note "Type their name first, then choose who pays for them."

## 21 Nov 2026: your name, with (You), everywhere

- **Wherever the app named the organiser just "You", it now says their name with (You)**: "Raj Rana (You)" (Raj). This covers the new kitty chips, Add a person (list and "Who pays for them"), the Shares screen, the kitty page rows, the person screen title, the share preview, the scan screens and groups. Sentences like "You cover their share" and "Your share" stay as they are, and so does the You picture in the corner when there's no photo.

## 21 Nov 2026: full names, Alcohol and Non-Veg

- **People who share a name are kept apart** (Raj: there may be 2 or more people with the same name). Adding a group to a kitty matches people by mobile number, and only by name when one of them has no number, so two Biba Bajajs with different numbers both come in. Where names clash in a list, the last 4 digits of the number are shown: "Biba Bajaj (…4321)". On the member page, names show in full and numbers are never shown.
- **The member page uses the organiser's full name**, not just their first name.
- **Food and drink labels are "Veg" or "Non-Veg", and "Alcohol" or "No Alcohol"**, everywhere: the person screen, group and kitty lists, voice cards, the scan screen and the member page tags. Speaking still understands "drinks" and "doesn't drink".

## 21 Nov 2026: your name in groups

- **Groups show your name with (You)**, like "Raj (You), Amrita, Mithu", on the Groups list and the group's screen, instead of just "You" (Raj).

## 21 Nov 2026: group buttons beside the name, clearer popups

- **Share and Edit sit side by side on the right of each group**, centred on it (Raj).
- **Leaving or deleting a group explains what happens first.** Leave: it goes from your Kitty only, and others keep it (for your own group, it also says to delete it to remove it from everyone). Delete: "Delete Cousins for everyone?", it goes from the Kitty of anyone you shared it with, they can't get it back, and kitties already made with it don't change.

## 21 Nov 2026: a screen for each group

- **Tapping a group in the Groups tab opens it** to edit (Raj). On that screen you can rename it, add or remove people, **Leave this group**, or **Delete this group** (red, only for groups you made).
- **The list shows just Share and Edit, in a row under each group**, left aligned. Leave and Delete moved to the group's screen. When picking a group for a new kitty, tapping it still adds everyone.

## 21 Nov 2026: edit link under the people

- **"Nobody has paid yet. Edit the amounts or people" sits straight under the list of people** on the kitty page, not in the footer (Raj).

## 21 Nov 2026: deleting groups

- **Whoever made a group can delete it** (Raj). It goes from everyone's Kitty, including people it was shared with. Kitties already made with it don't change, since they keep their own copy of the people. Delete is a red button under Leave, shown only on groups you made. Others can still only leave. New database function: delete_group.
- **The group buttons are smaller, with centred text** (Raj). Small buttons everywhere now centre their text.

## 21 Nov 2026: editing groups

- **Each group has Share, Edit and Leave, stacked** (Raj). Edit opens the group in the New group screen with its name and people filled in. Saving makes a new group and drops your old copy, even if you renamed it, following the rule that any change makes a new group. Anyone you shared the old one with keeps theirs. No database change.

## 21 Nov 2026: kitty card tags

- **MOMENT and GOAL tags are 20% smaller** and sit closer to the card's top right corner (Raj). **GOAL is blue, #4682B4**, with white text, like the orange MOMENT tag. DRAFT and SETTLING stay outlined.

## 21 Nov 2026: quieter Archive, Scan on Shares

- **Archive is a red text link, "Archive this kitty"**, above the scan note on the kitty page (Raj: the red button was too loud). Unarchive is a plain link in the same place.
- **The Shares screen ends with a green "Scan the bill"** instead of Done (moments); the back arrow keeps the amounts. Goals keep Done.
- The amount boxes on Shares are wider, so amounts like ₹1,405.66 aren't cut off.

## 21 Nov 2026: voice, in natural sentences, with numbers shown

- **Speak naturally** (Raj): "Please add Biba Bajaj vegetarian drinks, alcohol. Add a Api Bajaj non-vegetarian doesn't drink alcohol, Gaurav Shrawat alcohol, veg etc" gives three people with their tags. The reader works word by word, so it copes without commas; words like please, add, a and etc are ignored.
- **Every voice card shows the number it will add and where it came from**: "From your contacts, +91 …", "From your groups and kitties, +91 …", or "No number yet", with **Pick from contacts** to set it by hand. The contact search also finds "Biba B" for "Biba Bajaj", and explains when the iPhone gives Kitty only limited contacts access.

## 21 Nov 2026: drafts, Create kitty, and named colours

Decided with Raj:

- **"Create kitty" makes a kitty live straight away**, ready to share (it used to save a draft until the link was shared). Amounts stay editable until someone pays.
- **Drafts now only come from scanning a bill first.** A draft's screen says "This kitty is a draft: it isn't live yet, so friends can't pay", with a green **Create kitty** button (then the share options appear) and "Not now, back to my kitties".
- **Scan the bill is a green main button** on the kitty page (grey once someone pays). **Archive is red, #ED2939**, with white text; Unarchive stays outlined.
- **The colours are listed in `docs/colours.md`**, and named in `theme.ts` (`action`, `selected`, `destructive`, `moment`) and `globals.css`.

## 21 Nov 2026: scan the bill from anywhere, until someone pays

- **Scanning is offered wherever a kitty's amounts are set** (Raj): the new kitty screen, Shares (Adjust), Edit kitty and the share screen (drafts included), as well as the kitty page. It works until anyone pays. From Edit kitty, your edits are saved first, then the camera opens. The share screen says "Rescan the bill" once there's a checked bill.

## 20 Nov 2026: adding people by voice

Decided with Raj:

- **"Add people by voice" on New group**: an in-app mic button (expo-speech-recognition, Indian English) with live text you can correct or type, then "Find these people".
- **Kitty reads names with food and drink**: "Devika, veg, alcohol. Kabir, non-veg, no alcohol" (`parseSpokenPeople` in packages/core). Tags come from what was said, else from the organiser's groups and past kitties (when one match), else Kitty asks. "Add N people" waits until everyone has both.
- **Contacts search** (Raj chose it): Kitty asks once for permission to search the phone's contacts, looks up each spoken name on the phone, and asks "Which Devika in your contacts?" when several match. Only the people added are saved. This replaced the "Kitty only sees the people you pick" promise; the privacy policy says so.
- **Needs a new app build** (speech recognition and the contacts permission are native). Builds from before this keep working but stop getting over-the-air updates until reinstalled.

## 20 Nov 2026: Groups tab, tab icons, profile photo, orange MOMENT tag

Decided with Raj:

- **The footer is Kitties, Groups, Activity and Help**, each with a line icon (layers, people, bell, question mark). The Groups tab is the groups screen (favourites, recent, all, with Share and Leave), with **New group** to make one without starting a kitty, using the same Add a person screen.
- **Group settings are a starting point** (Raj): adding a group copies its people into the kitty, so food and drink (or anything else) changed there affects that kitty only. The group changes only if you save the kitty's people as a group under the same name.
- **A profile photo** for the You picture: Take photo or Choose photo (Upload photo on the web) in Your details, cropped square and shrunk to 400 px, with Remove photo. Stored in a public "avatars" bucket under the organiser's own folder with a random file name; only they can add or remove files there. The privacy policy now mentions it.
- **The MOMENT tag on kitty cards is orange, #F38427, with white text and 3px corners.** GOAL, DRAFT and SETTLING stay outlined. White on that orange is about 2.6:1 contrast; fine for a short label, but not for longer text.

## 20 Nov 2026: colour for actions and selections

Decided with Raj:

- **Main action buttons are green, #52A447**, with white text, in the app and on the pay page (Create kitty, Add to kitty, Confirm, I've paid and so on). Secondary buttons stay outlined.
- **Selected options are stone, #9F9484**: Moment/Goal, Veg/Non-veg, Drinks, people chips, the chosen date, reminder switches. Text on stone is ink, because white on that stone is hard to read.
- The bill-line tags (veg, non-veg, alcohol) keep the wire's black, grey and white: they're a colour code, not a selection.
- **Add a person has one pinned green button**: "Add to kitty" while a name is being filled in, "Done, 4 people in" once the form is empty, "Save changes" when editing.
- Note: white on #52A447 is about 3:1 contrast, below the usual 4.5:1 for 16 pt text. A slightly darker green (#3E8A35) would pass if that matters for the pilot.

## 20 Nov 2026: scanning locks once someone pays; the groups screen

Decided with Raj:

- **"Scan the bill" greys out once anyone (other than the organiser) has paid**, with a line saying why. This means a moment kitty can't be settled from the real bill after payments start: amounts stay as asked. (Raj chose this over keeping the scan for top-ups and refunds.) Goals keep "Enter the final cost".
- **Help is kept up to date with every change** (Raj), and each Help section has a small line icon (Feather icons from `@expo/vector-icons`, which needed no new build).
- **Saved groups get their own screen**: Favourites (starred, your own setting), Recent (the last three you used), then All groups. Each has a star, Share and Leave. From a new kitty, "Add a saved group" opens it and tapping a group adds everyone; Your details links to the same screen to manage them.

## 20 Nov 2026: scanning from the Shares screen

- **Screen 4 (Shares) offers "Have the bill already? Scan it for exact shares"** as well as screen 2 (Raj). It returns to screen 2 to save the draft and open the camera, since that's where the name, date and UPI ID are checked. Its note now says amounts can change until someone pays, and that a scan replaces them with each person's exact share.
- Fixed: scanning before sharing kept everyone but forgot who pays for whom. It now saves that too.

## 20 Nov 2026: archiving, rescanning and saved groups

Decided with Raj:

- **Archive** sits under "Scan the bill" in a kitty. Archived kitties leave the home list and appear under **"Archived kitties (N)"** at the bottom of home, where they can be opened or unarchived. Friends' links keep working; archived kitties send no reminders.
- **"Rescan the bill"** replaces "Scan the bill" once a kitty has a checked bill.
- **Saved groups**: "Save these people as a group" on the new kitty screen keeps each person's name, number, food and drink, and who pays for whom, **including the organiser**. Next time, tap the group under "Add a saved group" to add everyone except yourself (matched by login, or by mobile number), then add or remove people as usual.
- **Groups are shared, and never change once made** (Raj): saving under a name makes a new group; if you had one with that name you swap to the new one, and anyone you shared the old one with keeps it. **Share** (in Your details) sends a WhatsApp link, thekitty.app/g/<link>, which adds the group in the Kitty app or on app.thekitty.app. **Anyone can leave** a group; it's deleted only when the last person leaves. This lets friends take turns organising with the same group.
- **Later**: once SMS login verifies mobile numbers, groups will reach a member automatically when they sign up with their number. Not now, because sign-up numbers aren't verified with email login, so someone could claim a friend's number.

## 20 Nov 2026: Help, account deletion, privacy policy and terms (step 10)

Decided with Raj:

- **The footer is Kitties, Activity and Help.** "You" moved to the picture at the top right, which shows on every screen once logged in, except your details, a kitty's feed and its share screen (those have "Share link" or a close button there instead).
- **Help** explains how Kitty works in tap-to-open sections: getting started, starting a kitty, sharing and getting paid, the bill and settling up, goals and monthly parts, what your friends see, your account, and privacy and contact.
- **Delete my account** is in Your details (App Store rule). It removes bill photos, then the account, which deletes the profile, every kitty with its people and payment records, notifications and phones. Shared links stop working.
- **Privacy policy and terms** are at thekitty.app/privacy and /terms, linked from sign-up, Help and the home page. They name **Kitty Labs** and **hello@thekitty.app**. They were written to match what Kitty stores; have them reviewed before the public launch.
- Functions needing more rights than the caller now live in the private schema, with thin public wrappers, so Supabase's security check has no warnings.

**Not done yet**

- hello@thekitty.app needs email forwarding set up on the domain.

## 20 Nov 2026: a person's breakdown for the organiser

- **Tap anyone in a kitty's feed** to see their food and drink, their share and status, and how the share was worked out: veg, non-veg and alcohol with the dishes for a scanned bill, or the typed split. It's the same breakdown they see on their pay page, so the organiser can answer "why is mine ₹1,250?". Confirm or Nudge sits at the bottom. Someone paying for others shows a block for each person; someone paid for links to their payer. Not in the wires.

## 20 Nov 2026: personal links in nudges

- **The group link no longer singles anyone out.** Every name in "Who are you?" (screen 14) has an arrow; the wire's highlighted first name was only illustrating a tappable row.
- **Nudges and top-up requests carry a personal link** (`/k/<link>?for=<person>`), decided with Raj. It opens with "I'm Nathan, continue" at the top, one tap to their pay screen, and "Not Nathan? Pick your name" below. It only preselects: it grants nothing the group link doesn't. The group reminder keeps the shared link.

## 20 Nov 2026: the "Thanks" screen (screen 16) and the receipt

Decided with Raj:

- **Screen 16 is now an overview** (Raj, later the same day): "Your share" with its status, then how it was worked out (veg, non-veg and alcohol with dishes for a scanned bill, or the typed split), then the group progress bar. The list of everyone sits behind "See who's paid". The pay screen (15) keeps "Everyone's share", where people check the split before paying.
- In that list, each person shows **Veg or Non-veg and Drinks** as small tags, **their amount** on the right, and their status underneath: "Paid, confirmed ✓", "Paid, waiting for Raj to confirm", "Not paid yet", or "Kabir pays for them".
- **Members can see the bill photo.** "View receipt" (on screen 16 and under "How your share was worked out") opens the photo and the lines Kitty read. This replaces the earlier lines-only decision (spec section 12 kept photos private). The photo is shown through a link that expires after 10 minutes, and only to people with the kitty link.

## 20 Nov 2026: over-the-air updates for the phone apps

- **Expo updates are on** (decided with Raj). A change that's only app code (screens, wording, fixes) reaches installed apps the next time they're opened twice: the first launch downloads it, the next one shows it. Publish with `./scripts/publish-update.sh "what changed"` from `apps/mobile`. **Don't edit the `scripts` in `apps/mobile/package.json`** without making new builds: Expo's fingerprint includes them, and a change stops installed builds taking updates (this happened once on 20 Nov 2026).
- **A new build is still needed** when native parts change: new packages with native code, permissions, app icon, SDK upgrades. Kitty uses Expo's "fingerprint" runtime version, so an update is only offered to builds it's compatible with; older builds never get an update that would crash them.
- **App settings** (live Supabase address and public key, member page address, email login) now live in Expo's environment settings for preview and production, not in `eas.json`, so builds and updates always use the same values. None of them are secret.

## 20 Nov 2026: paying for someone else

**Decided with Raj**

- **Anyone can pay for someone else**, for example a parent for a child. On screen 3, "Who pays for them" offers Themselves or anyone who pays for themselves. The person keeps their own food and drink settings, so a scanned bill splits correctly for them.
- **They count as a full person in an equal split.** Adjust their amount on screen 4 for less, for example half.

**How it works**

- The payer is asked for one amount: their share plus everyone they pay for. Their pay page shows a breakdown "For you" and "For Aarav", and "For you and Aarav ₹2,000".
- People paid for by someone else aren't in "Who are you?", aren't messaged (no mobile number), and show under their payer in the feed ("Pays for Aarav too") and in "Everyone's share" ("Aarav, Kabir pays").
- Settle up works out each person's new share, then adds them up for whoever pays, so one top-up or refund covers the family. Goal parts split the combined amount.
- No chains: someone who pays for others pays for themselves, and nobody pays for the organiser. Removing a payer puts the people they paid for back on their own. Who pays for whom locks with the amounts, once someone pays.

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
| Screen 17 "See the scanned bill" | Decided 20 Nov 2026: members see the photo too ("View receipt"). | Done |
| Screen 18 "I've got the ₹600" | Spec has only the organiser marking refunds sent. Does the member's tap confirm it, or is it just a signal? | Step 7 |
| Spec 5, iPhone app links | `gpay://`, `phonepe://` and `paytmmp://` schemes in core are unverified. Test on real phones. | Step 5 |
| Spec 13, Sentry | Not wired yet: needs a Sentry account and DSN. | Before pilot |
