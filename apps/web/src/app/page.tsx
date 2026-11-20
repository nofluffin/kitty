import type { Metadata } from "next";

import { Body, Header, Label, Note, Page, Small, Title } from "@/components/ui";

export const metadata: Metadata = {
  title: "Kitty",
  description: "Collect from the group before the bill arrives. Friends pay their share by UPI from a WhatsApp link.",
  robots: { index: true, follow: true },
};

// Not drawn in the wires. Built from the wires' cover line and screen 21's three steps.
const STEPS = [
  ["Set the amount", "Type a total, or scan the bill for exact shares."],
  ["Share the link on WhatsApp", "Friends pick their name. No app needed."],
  ["Get paid first", "Each share lands in your UPI. Then you pay the bill."],
] as const;

export default function Home() {
  return (
    <Page
      header={<Header title="Kitty" />}
      footer={<Small>Got a Kitty link from a friend? Open it to pay your share. You don’t need the app.</Small>}
    >
      <Title>Collect from the group before the bill arrives</Title>
      <Body>
        Kitty works out everyone’s share for dinners, cabs, tickets and gifts. Friends pay you from their own UPI app, straight
        from a WhatsApp link.
      </Body>

      <ol className="mt-6 flex flex-col gap-4 border border-line bg-surface px-4 pt-4 pb-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span
              className="flex size-[27px] shrink-0 items-center justify-center rounded-full border border-ink text-sm font-bold text-ink"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-base leading-[22px] font-bold text-ink">{title}</p>
              <p className="mt-px text-sm leading-[21px] text-text">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <Note>Kitty never holds or moves money. Everyone pays you directly, and you confirm what arrives.</Note>
      </div>

      <Label className="mt-8">The organiser app</Label>
      <p className="mt-2 text-base leading-6 text-ink">Coming soon to Android and iPhone.</p>
    </Page>
  );
}
