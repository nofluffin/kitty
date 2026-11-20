import type { Metadata } from "next";

import { COMPANY, CONTACT, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy policy, Kitty" };

/** Written 20 Nov 2026 to match what Kitty actually stores. Have it reviewed before the public launch. */
export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="20 November 2026">
      <section>
        <p>
          Kitty helps a group collect money for a shared plan. One person, the organiser, starts a kitty in the Kitty app and shares a
          link. Friends open the link and pay the organiser directly by UPI. Kitty is run by {COMPANY} (&ldquo;we&rdquo;). This policy
          explains what we collect, why, and the choices you have.
        </p>
        <p>
          <strong>Kitty never holds or moves money.</strong> Payments go from your UPI app to the organiser&rsquo;s UPI ID. We don&rsquo;t
          see your bank details, card details or UPI PIN.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <p>
          <strong>From organisers</strong>: name, mobile number, email address (used for login codes) and UPI ID.
        </p>
        <p>
          <strong>About people in a kitty</strong>, added by the organiser: name, optionally a mobile number (picked from the
          organiser&rsquo;s contacts or typed), whether they eat veg or non-veg and whether they drink, and their share.
        </p>
        <p>
          <strong>Payment records</strong>: whether each share is requested, marked as paid or confirmed by the organiser, and a UPI
          reference number if a friend chooses to send one. We record what people tell us; we don&rsquo;t check bank data.
        </p>
        <p>
          <strong>Bill photos</strong>: if the organiser scans a bill, the photo and the lines read from it (dishes and prices).
        </p>
        <p>
          <strong>Technical data</strong>: a cookie on the kitty link that remembers which name you picked on that browser, when a link
          was last opened, the organiser&rsquo;s phone push notification token, and standard server logs.
        </p>
        <p>
          The organiser picks contacts one at a time. Kitty only sees the people picked, never the whole address book. Kitty doesn&rsquo;t
          read SMS messages.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run the kitty: work out shares, show each person what they owe, and show the organiser who has paid.</li>
          <li>To send the organiser login codes by email and notifications about payments and reminders.</li>
          <li>To read scanned bills and split them by veg, non-veg and alcohol.</li>
          <li>To keep Kitty secure, fix problems and understand how it&rsquo;s used.</li>
        </ul>
        <p>We don&rsquo;t sell personal data, and we don&rsquo;t use it for advertising.</p>
      </section>

      <section>
        <h2>Who can see what</h2>
        <p>
          Anyone with a kitty&rsquo;s link can see the kitty&rsquo;s name, the people in it, their food and drink choices, their shares,
          whether they&rsquo;ve paid, and the scanned bill. Only share a link with the people in the kitty. Mobile numbers and refund UPI
          IDs are only shown to the organiser.
        </p>
      </section>

      <section>
        <h2>Services we use</h2>
        <p>We use these providers to run Kitty. They process data only to provide their service to us:</p>
        <ul>
          <li>Supabase: database, login and file storage, hosted in Mumbai, India.</li>
          <li>Vercel: hosting for the kitty links and website.</li>
          <li>Resend: sending login code emails.</li>
          <li>Expo (650 Industries): app updates and delivering push notifications.</li>
          <li>Anthropic: reading scanned bill photos. Photos are sent only when an organiser scans a bill.</li>
          <li>Apple and Google: the app stores and push notification delivery.</li>
        </ul>
        <p>Some of these providers process data outside India.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep an organiser&rsquo;s account and kitties until the organiser deletes them. Deleting your account in the app (Your
          details, then Delete my account) removes your details, your kitties with everyone&rsquo;s names and payment records, and bill
          photos. Server logs are kept for a short time for security.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You can see and correct your details in the app, and delete your account at any time. If you&rsquo;re in someone else&rsquo;s
          kitty and want your details changed or removed, ask the organiser, or email us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
          and we&rsquo;ll help. You can also ask us what data we hold about you.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Organisers must be 18 or over. An organiser may add a child to a kitty, for example to split a family meal, with the child&rsquo;s
          share paid by a parent. Only the child&rsquo;s first name, food and drink choices and share are stored.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If we change this policy, we&rsquo;ll update the date above, and tell organisers in the app about important changes. Questions:{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
