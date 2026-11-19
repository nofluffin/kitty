import {
  buildUpiAppLinks,
  buildUpiUri,
  formatRupees,
  formatShortDate,
  isEqualSplit,
  kittyPaymentNote,
  payProgress,
  pickList,
  statusList,
  whatsAppUrl,
} from "@kitty/core";
import Link from "next/link";
import QRCode from "qrcode";

import { CopyButton, PaySection } from "@/components/pay-section";
import { Body, buttonClass, Card, GetKitty, Header, Label, NoInstall, Note, Page, Progress, Small, Title } from "@/components/ui";
import type { MemberRow, MemberView, OpenKitty } from "@/server/member-view";

import { claimName, forgetMe, markPaid, sendReference } from "./actions";

/** "today at 7:42 pm", "Thu 19 Nov at 7:42 pm", in India time. */
function whenMarked(iso: string | null): string {
  if (!iso) return "earlier";
  const d = new Date(iso);
  const tz = "Asia/Kolkata";
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toLowerCase();
  const day = d.toLocaleDateString("en-CA", { timeZone: tz });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  return `${day === today ? "today" : formatShortDate(day)} at ${time.replace(/\s/g, " ")}`;
}

const STATUS_TEXT = { paid: "Paid ✓", waiting: "Waiting for", not_received: "Not received yet", unpaid: "Not paid yet" } as const;

// ---------------------------------------------------------------------------
// Screen 27: closed, cancelled, not found, no connection
// ---------------------------------------------------------------------------

export function Gone({ view }: { view: Exclude<MemberView, OpenKitty> }) {
  const message =
    view.kind === "closed"
      ? {
          eyebrow: `${view.organiserName}’s kitty`,
          title: `${view.title} is closed`,
          body: `${view.organiserName} closed this kitty${view.closedAt ? ` on ${formatShortDate(view.closedAt.slice(0, 10))}` : ""}. There is nothing more to pay.`,
        }
      : view.kind === "cancelled"
        ? { eyebrow: `${view.organiserName}’s kitty`, title: `${view.title} was cancelled`, body: "Nobody needs to pay." }
        : view.kind === "not_found"
          ? { eyebrow: "Kitty", title: "Link not found", body: "Check the link with whoever sent it." }
          : { eyebrow: "Kitty", title: "No connection", body: "Kitty can’t load right now. Try again in a moment." };
  return (
    <Page header={<Header title="Kitty" right={<NoInstall />} />} footer={<GetKitty />}>
      <div className="mt-2">
        <Card className="pt-[18px] pb-5">
          <p className="text-sm leading-[21px] text-text">{message.eyebrow}</p>
          <h2 className="mt-2 text-2xl leading-[30px] font-bold text-ink">{message.title}</h2>
          <p className="mt-2 text-base leading-6 text-ink">{message.body}</p>
        </Card>
        {view.kind === "unavailable" ? (
          <a href="" className={`${buttonClass.secondary} mt-6`}>
            Try again
          </a>
        ) : null}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Screen 14: open the link, pick your name
// ---------------------------------------------------------------------------

export function PickName({ kitty, confirmId, notListed }: { kitty: OpenKitty; confirmId?: string; notListed?: boolean }) {
  const shares = kitty.members.map((m) => m.sharePaise);
  const equal = isEqualSplit(shares);
  const progress = payProgress(kitty.members);
  const claim = claimName.bind(null, kitty.slug);
  const confirming = kitty.members.find((m) => m.id === confirmId && !m.isOrganiser && m.state !== "paid");

  if (confirming) {
    return (
      <Page header={<Header title="Kitty" right={<NoInstall />} />}>
        <Title>Is this you, {confirming.name}?</Title>
        <Body>Someone already picked this name on another phone. If it’s you on a new phone, carry on.</Body>
        <form action={claim} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="memberId" value={confirming.id} />
          <input type="hidden" name="confirmed" value="yes" />
          <button type="submit" className={buttonClass.primary}>
            Yes, I’m {confirming.name}
          </button>
          <Link href={`/k/${kitty.slug}`} className={buttonClass.secondary}>
            No, go back
          </Link>
        </form>
      </Page>
    );
  }

  const ask = whatsAppUrl(
    kitty.organiser.phone ?? "",
    `Hi ${kitty.organiser.name}, I’m in ${kitty.title} but my name isn’t on the Kitty link. Can you check?`,
  );

  return (
    <Page
      header={<Header title="Kitty" right={<NoInstall />} />}
      footer={<Small>You pay {kitty.organiser.name} directly from your own UPI app. Kitty never holds the money.</Small>}
    >
      <Card className="pt-[18px] pb-[18px]">
        <p className="text-sm leading-[21px] text-text">{kitty.organiser.name} started a kitty</p>
        <h2 className="mt-1.5 text-2xl leading-[30px] font-bold text-ink">{kitty.title}</h2>
        <p className="mt-1.5 text-base leading-6 text-ink">
          {equal ? `${formatRupees(Math.min(...shares))} each, ` : `${formatRupees(kitty.totalPaise)} in total, `}pay by{" "}
          {formatShortDate(kitty.dueDate)}
        </p>
        <div className="mt-3.5">
          <Progress value={progress.total ? progress.paid / progress.total : 0} />
        </div>
        <p className="mt-2.5 text-sm leading-[21px] text-text">
          {progress.paid} of {progress.total} have paid
        </p>
      </Card>

      <h2 className="mt-6 text-xl leading-6 font-bold text-ink">Who are you?</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {pickList(kitty.members).map((m, i) =>
          m.state === "paid" ? (
            <li
              key={m.id}
              className="flex h-[52px] items-center justify-between border border-dashed border-line bg-sunken px-4 text-text"
            >
              <span className="text-base">{m.name}</span>
              <span className="text-sm">Paid ✓</span>
            </li>
          ) : (
            <li key={m.id}>
              <form action={claim}>
                <input type="hidden" name="memberId" value={m.id} />
                <button
                  type="submit"
                  className={`flex h-[52px] w-full items-center justify-between border bg-surface px-4 text-left active:opacity-80 ${i === 0 ? "border-ink" : "border-line"}`}
                >
                  <span className="text-base text-ink">{m.name}</span>
                  <span className="text-sm text-muted">
                    {m.state === "waiting" ? `Waiting for ${kitty.organiser.name}` : i === 0 ? "→" : ""}
                  </span>
                </button>
              </form>
            </li>
          ),
        )}
      </ul>

      {/* Decided 19 Nov 2026: a missing name means asking the organiser. Amounts stay locked. */}
      {notListed ? (
        <div className="mt-6">
          <Note>
            Only {kitty.organiser.name} can add people to this kitty. Ask them to check.
            {ask ? (
              <a href={ask} className={`${buttonClass.small} mt-3 flex w-fit font-bold`}>
                Message {kitty.organiser.name} on WhatsApp
              </a>
            ) : null}
          </Note>
        </div>
      ) : (
        <Link href={`/k/${kitty.slug}?missing=1`} className={`${buttonClass.link} mt-6 w-fit`}>
          My name is not here
        </Link>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Screen 15: pay your share
// ---------------------------------------------------------------------------

export async function PayShare({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const payment = {
    payeeUpiId: kitty.upiId,
    payeeName: kitty.organiser.name,
    amountPaise: me.sharePaise,
    note: kittyPaymentNote(kitty.title),
  };
  const uri = buildUpiUri(payment);
  const qr = await QRCode.toString(uri, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  const amount = formatRupees(me.sharePaise);
  const paid = markPaid.bind(null, kitty.slug);

  return (
    <Page
      header={<Header title={kitty.title} left={<BackToNames slug={kitty.slug} />} />}
      footer={<Note>Back from the UPI app, this page asks “Did the payment go through?” so step 2 is one tap.</Note>}
    >
      <p className="text-base leading-6 text-text">{me.name}, your share</p>
      <p className="mt-0.5 text-[40px] leading-[48px] font-bold text-ink">{amount}</p>
      <p className="mt-1 text-sm leading-[21px] text-text">
        To {kitty.organiser.name}, {kitty.upiId}
      </p>

      <Label className="mt-8">Step 1, pay</Label>
      <div className="mt-3">
        <PaySection uri={uri} appLinks={buildUpiAppLinks(payment)} label={`Pay ${amount} with a UPI app`} markPaid={paid} />
      </div>
      <Small className="mt-3.5">Opens GPay, PhonePe, Paytm or any UPI app with the amount filled in.</Small>

      <div className="mt-4 flex gap-3 border border-line bg-surface p-3">
        <div
          className="size-24 shrink-0 [&>svg]:size-full"
          role="img"
          aria-label={`QR code to pay ${amount} to ${kitty.upiId}`}
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="flex flex-col justify-between">
          <p className="text-sm leading-[21px] text-text">Button not working? Scan this or copy the UPI ID.</p>
          <div>
            <CopyButton text={kitty.upiId} label="Copy UPI ID" />
          </div>
        </div>
      </div>

      <Label className="mt-6">Step 2, tell the group</Label>
      <form action={paid} className="mt-3">
        <button type="submit" className={`${buttonClass.secondary} font-bold`}>
          I’ve paid
        </button>
      </form>
      <Small className="mt-3.5">{kitty.organiser.name} gets a prompt to confirm it arrived.</Small>
    </Page>
  );
}

function BackToNames({ slug }: { slug: string }) {
  return (
    <form action={forgetMe.bind(null, slug)}>
      <button type="submit" aria-label="Not you? Pick another name" className="-ml-1 flex h-11 w-9 items-center text-xl text-ink">
        ←
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Screen 16: paid, waiting (and confirmed)
// ---------------------------------------------------------------------------

export function Waiting({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const progress = payProgress(kitty.members);
  const amount = formatRupees(me.sharePaise);
  const org = kitty.organiser.name;
  const body =
    me.sharePaise === 0
      ? `${org} set your share to nothing, so there’s nothing to pay.`
      : me.state === "paid"
        ? `${org} confirmed your ${amount}. You’re all done.`
        : `You marked ${amount} as paid. ${org} will confirm once it lands.`;

  return (
    <Page
      header={<Header title={kitty.title} right={<span className="text-sm text-text">{formatShortDate(kitty.dueDate)}</span>} />}
      footer={<GetKitty />}
    >
      <Title>Thanks, {me.name}</Title>
      <Body>{body}</Body>
      {kitty.status === "settling" ? (
        <div className="mt-4">
          <Note>{org} is settling up the final bill. If your share changes, this page will say so.</Note>
        </div>
      ) : null}

      <Card className="mt-6">
        <Progress value={progress.total ? progress.paid / progress.total : 0} />
        <div className="mt-2.5 flex justify-between text-sm leading-[21px] text-text">
          <span>
            {progress.paid} of {progress.total} confirmed
          </span>
          {progress.waiting > 0 ? (
            <span>
              {progress.waiting} waiting for {org}
            </span>
          ) : null}
        </div>
      </Card>

      <ul className="mt-6 border-t border-line">
        {statusList(kitty.members, me.id).map((m) => (
          <li key={m.id} className="flex min-h-[49px] items-center justify-between border-b border-line">
            <span className="text-base text-ink">{m.id === me.id ? "You" : m.name}</span>
            <span className={`text-sm ${m.state === "paid" ? "text-muted" : "text-text"}`}>
              {m.state === "waiting" ? `${STATUS_TEXT.waiting} ${org}` : STATUS_TEXT[m.state]}
            </span>
          </li>
        ))}
      </ul>

      <form action={forgetMe.bind(null, kitty.slug)} className="mt-6">
        <button type="submit" className={buttonClass.link}>
          Not {me.name}? Pick another name
        </button>
      </form>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Screen 26: payment not received
// ---------------------------------------------------------------------------

export function NotReceived({ kitty, me, refInvalid }: { kitty: OpenKitty; me: MemberRow; refInvalid?: boolean }) {
  const amount = formatRupees(me.sharePaise);
  const org = kitty.organiser.name;
  const uri = buildUpiUri({ payeeUpiId: kitty.upiId, payeeName: org, amountPaise: me.sharePaise, note: kittyPaymentNote(kitty.title) });
  return (
    <Page header={<Header title="Kitty" right={<NoInstall />} />}>
      <Title>
        {org} hasn’t got your {amount} yet
      </Title>
      <Body>You marked it as paid {whenMarked(me.markedAt)}. Check your UPI app to see what happened.</Body>

      <Label className="mt-8">If it failed or is still pending</Label>
      <a href={uri} className={`${buttonClass.primary} mt-3`}>
        Pay {amount} again
      </a>
      <Small className="mt-3.5">If money left your account and the payment failed, your bank returns it.</Small>

      <Label className="mt-9">If it went through</Label>
      <form action={sendReference.bind(null, kitty.slug)} className="mt-6">
        <label htmlFor="upiRef" className="block text-xs leading-4 font-bold tracking-[1.1px] text-text uppercase">
          UPI reference number
        </label>
        <input
          id="upiRef"
          name="upiRef"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12 digit reference"
          maxLength={16}
          aria-invalid={refInvalid || undefined}
          className={`mt-1.5 h-[47px] w-full rounded-[3px] border bg-surface px-3 text-base text-ink placeholder:text-muted ${refInvalid ? "border-danger" : "border-line"}`}
        />
        {refInvalid ? (
          <p className="mt-1.5 text-sm text-danger" role="alert">
            A UPI reference is 12 digits. Check it in your UPI app.
          </p>
        ) : (
          <Small className="mt-[7px]">You can find this in the payment details in your UPI app.</Small>
        )}
        <button type="submit" className={`${buttonClass.secondary} mt-4 font-bold`}>
          Send the reference to {org}
        </button>
      </form>
    </Page>
  );
}
