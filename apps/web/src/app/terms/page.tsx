import type { Metadata } from "next";

import { COMPANY, CONTACT, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of use, Kitty" };

/** Written 20 Nov 2026. Have it reviewed before the public launch. */
export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="20 November 2026">
      <section>
        <p>
          These terms cover using Kitty: the Kitty app for organisers and the kitty links friends open to pay. Kitty is run by {COMPANY}{" "}
          (&ldquo;we&rdquo;). By using Kitty you agree to these terms and our <a href="/privacy">privacy policy</a>.
        </p>
      </section>

      <section>
        <h2>What Kitty is, and isn&rsquo;t</h2>
        <p>
          Kitty is a tool for working out shares and keeping track of who has paid. <strong>Kitty is not a bank, wallet or payment
          service.</strong> It never holds, receives or sends money. Payments are made between people through their own UPI apps, and are
          covered by their banks&rsquo; and UPI apps&rsquo; terms.
        </p>
        <p>
          A payment marked as paid in Kitty means a person said they paid. Only the organiser can confirm it arrived. We don&rsquo;t verify
          payments, and we&rsquo;re not responsible for payments that fail, go to the wrong UPI ID, or are disputed.
        </p>
      </section>

      <section>
        <h2>Organisers</h2>
        <ul>
          <li>You must be 18 or over and give accurate details, including your own UPI ID.</li>
          <li>Only add people who have agreed to be in the kitty, and only share the link with them.</li>
          <li>You&rsquo;re responsible for the amounts you ask for, for confirming payments honestly, and for sending refunds you owe.</li>
          <li>Keep your login to yourself. You&rsquo;re responsible for what happens in your account.</li>
        </ul>
      </section>

      <section>
        <h2>Bill scans</h2>
        <p>
          Kitty reads bills automatically and can make mistakes. Check the lines before working out shares. The organiser is responsible
          for the final amounts.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&rsquo;t use Kitty for anything illegal, to collect money under false pretences, to harass people, or to try to break or
          overload the service. We may suspend accounts that do.
        </p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          Kitty is free during the pilot. We&rsquo;re improving it all the time, so features may change, and it may sometimes be
          unavailable. Kitty is provided as it is, and to the extent the law allows, we aren&rsquo;t liable for indirect losses or for
          payments between people.
        </p>
      </section>

      <section>
        <h2>Ending</h2>
        <p>
          You can stop using Kitty and delete your account at any time from Your details in the app. These terms are governed by the
          laws of India.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms and will change the date above when we do. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
