import {
  buildUpiAppLinks,
  buildUpiUri,
  formatRupees,
  formatShortDate,
  isEqualSplit,
  kittyPaymentNote,
  payProgress,
  type PaymentStatus,
  pickList,
  statusList,
  whatsAppUrl,
} from "@kitty/core";
import Link from "next/link";
import QRCode from "qrcode";

import { CopyButton, PaySection } from "@/components/pay-section";
import { Body, buttonClass, Card, GetKitty, Header, Label, NoInstall, Note, Page, Progress, Small, Title } from "@/components/ui";
import type { MemberRow, MemberView, OpenKitty } from "@/server/member-view";

import { claimName, forgetMe, gotRefund, markPaid, saveRefundUpi, sendReference } from "./actions";

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

const hasOpenRefund = (m: MemberRow) => m.refund?.status === "requested" || m.refund?.status === "marked";

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
          m.state === "paid" && !hasOpenRefund(m) ? (
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
                    {hasOpenRefund(m)
                      ? "Money back"
                      : m.state === "waiting"
                        ? `Waiting for ${kitty.organiser.name}`
                        : i === 0
                          ? "→"
                          : ""}
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
  // Goals in parts: ask for the next part, not the whole share.
  const next = me.parts?.next ?? null;
  const owed = next?.amountPaise ?? me.sharePaise;
  const amount = formatRupees(owed);
  const paid = markPaid.bind(null, kitty.slug);

  return (
    <Page
      header={<Header title={kitty.title} left={<BackToNames slug={kitty.slug} />} />}
    >
      <p className="text-base leading-6 text-text">
        {me.name}, {next && me.parts ? `part ${next.partNumber} of ${me.parts.total}` : "your share"}
      </p>
      <p className="mt-0.5 text-[40px] leading-[48px] font-bold text-ink">{amount}</p>
      <p className="mt-1 text-sm leading-[21px] text-text">
        {next ? `Due ${formatShortDate(next.dueDate)}. ` : ""}To {kitty.organiser.name}, {kitty.upiId}
      </p>

      <Label className="mt-8">Step 1, pay</Label>
      <PayOptions kitty={kitty} amountPaise={owed} markPaid={paid} />

      <Label className="mt-6">Step 2, tell the group</Label>
      <form action={paid} className="mt-3">
        <button type="submit" className={buttonClass.primary}>
          I’ve paid
        </button>
      </form>
      <Small className="mt-3.5">{kitty.organiser.name} gets a prompt to confirm it arrived.</Small>

      <Label className="mt-8">How your share was worked out</Label>
      <ShareBreakdown kitty={kitty} me={me} />

      {me.parts ? <PartsList me={me} /> : null}
    </Page>
  );
}

const PART_STATUS: Record<PaymentStatus, string> = {
  requested: "To pay",
  marked: "Waiting to be confirmed",
  confirmed: "Paid ✓",
  not_received: "Not received yet",
  written_off: "Not needed",
};

/** Goals in parts: every part with its date and how it stands. Not drawn in the wires. */
function PartsList({ me }: { me: MemberRow }) {
  const parts = me.parts;
  if (!parts) return null;
  return (
    <>
      <Label className="mt-8">
        Your {parts.total} parts, {formatRupees(me.sharePaise)} in all
      </Label>
      <ul className="mt-3 border-t border-line">
        {parts.list.map((p, i) => (
          <li key={p.dueDate} className="flex min-h-[49px] items-center justify-between gap-3 border-b border-line">
            <span className="text-base text-ink">
              {formatRupees(p.amountPaise)}, {formatShortDate(p.dueDate)}
            </span>
            <span className={`text-sm ${p.status === "confirmed" ? "text-muted" : "text-text"}`}>
              {parts.next?.partNumber === i + 1 && p.status === "requested" ? "Next" : PART_STATUS[p.status]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * How to pay, used on screens 15 and 17. The QR code leads: GPay, PhonePe and Paytm
 * often refuse a payment link to a personal UPI ID ("exceeded the bank limit", even
 * for ₹1), but scanning the same details as a QR works. Tested on iPhone, 20 Nov 2026.
 */
async function PayOptions({ kitty, amountPaise, markPaid }: { kitty: OpenKitty; amountPaise: number; markPaid: () => Promise<void> }) {
  const payment = { payeeUpiId: kitty.upiId, payeeName: kitty.organiser.name, amountPaise, note: kittyPaymentNote(kitty.title) };
  const uri = buildUpiUri(payment);
  const amount = formatRupees(amountPaise);
  // A PNG, not an SVG, so iPhone and Android offer "Save to Photos" on a long press.
  const qr = await QRCode.toDataURL(uri, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  return (
    <>
      <div className="mt-3 border border-line bg-surface p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise */}
        <img src={qr} alt={`QR code to pay ${amount} to ${kitty.upiId}`} width={200} height={200} className="mx-auto block size-[200px]" />
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-[21px] text-text">
          <li>Take a screenshot, or press and hold the code to save it.</li>
          <li>In GPay, PhonePe or Paytm, tap Scan and pick it from your photos.</li>
        </ol>
        <p className="mt-2 text-sm leading-[21px] text-text">On another phone? Just scan it. The amount fills in.</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Small>Or pay {amount} to {kitty.upiId}</Small>
        <CopyButton text={kitty.upiId} label="Copy UPI ID" />
      </div>
      <div className="mt-4">
        <PaySection uri={uri} appLinks={buildUpiAppLinks(payment)} label="Open a UPI app" markPaid={markPaid} variant="secondary" />
      </div>
      <Small className="mt-2">Some apps block this for personal UPI IDs. If you see a bank limit message, use the code above.</Small>
    </>
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
  const body = me.refund?.status === "confirmed"
    ? `Your ${formatRupees(me.refund.amountPaise)} back is sorted. You’re square.`
    : me.topUp?.status === "marked"
      ? `You marked ${formatRupees(me.topUp.amountPaise)} as paid. ${org} will confirm once it lands.`
      : me.topUp?.status === "confirmed"
        ? `${org} confirmed your ${formatRupees(me.topUp.amountPaise)}. You’re square.`
        : kitty.status === "settling" && !me.topUp && !me.refund
          ? `Your share came to exactly what you paid. You’re square.`
          : me.sharePaise === 0
            ? `${org} set your share to nothing, so there’s nothing to pay.`
            : me.state === "paid"
              ? `${org} confirmed your ${amount}. You’re all done.`
              : me.parts?.next
                ? `You marked part ${me.parts.next.partNumber} of ${me.parts.total} (${formatRupees(me.parts.next.amountPaise)}) as paid. ${org} will confirm once it lands.`
                : `You marked ${amount} as paid. ${org} will confirm once it lands.`;

  return (
    <Page
      header={<Header title={kitty.title} right={<span className="text-sm text-text">{formatShortDate(kitty.dueDate)}</span>} />}
      footer={<GetKitty />}
    >
      <Title>Thanks, {me.name}</Title>
      <Body>{body}</Body>


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
  const owed = me.topUp ? me.topUp.amountPaise : (me.parts?.next?.amountPaise ?? me.sharePaise);
  const amount = formatRupees(owed);
  const org = kitty.organiser.name;
  const uri = buildUpiUri({ payeeUpiId: kitty.upiId, payeeName: org, amountPaise: owed, note: kittyPaymentNote(kitty.title) });
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

// ---------------------------------------------------------------------------
// Screens 17 and 18: after the final bill
// ---------------------------------------------------------------------------

const CATEGORY_NAME = { veg: "Veg dishes", nonveg: "Non-veg dishes", alcohol: "Alcohol" } as const;

/** "How your share was worked out" (screens 17 and 18): by category for a scanned bill, otherwise the typed split. */
/** Screen 15: how the share being asked for was worked out, before any settle up. */
function ShareBreakdown({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const org = kitty.organiser.name;
  const fixed = kitty.members.filter((m) => m.shareFixed);
  const fixedTotal = fixed.reduce((sum, m) => sum + m.sharePaise, 0);
  const splitWays = kitty.members.length - fixed.length;
  const rows: [string, string, boolean?][] = kitty.bill
    ? (["veg", "nonveg", "alcohol"] as const)
        .map((c) => kitty.bill!.categories.find((x) => x.category === c))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c): [string, string] =>
          c.memberIds.includes(me.id)
            ? [`${CATEGORY_NAME[c.category]} ${formatRupees(c.totalPaise)}, split ${c.memberIds.length} ways`, formatRupees(c.perHeadPaise)]
            : [CATEGORY_NAME[c.category], "Not charged"],
        )
    : me.shareFixed
      ? [
          [`Total ${formatRupees(kitty.totalPaise)}`, ""],
          [`Your amount, set by ${org}`, formatRupees(me.sharePaise)],
        ]
      : fixed.length > 0
        ? [
            [`Total ${formatRupees(kitty.totalPaise)}`, ""],
            [`Set by ${org} for ${fixed.map((m) => m.name).join(", ")}`, `−${formatRupees(fixedTotal)}`],
            [`The rest, split ${splitWays} ways`, formatRupees(me.sharePaise)],
          ]
        : [[`Total ${formatRupees(kitty.totalPaise)}, split ${kitty.members.length} ways`, formatRupees(me.sharePaise)]];
  if (kitty.bill) rows.push(["Your share", formatRupees(me.sharePaise), true]);
  return (
    <>
      <div className="mt-3 border border-line bg-surface px-4">
        {rows.map(([label, value, bold], i) => (
          <div key={label} className={`flex min-h-[45px] items-center justify-between gap-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
            <span className="text-base text-text">{label}</span>
            <span className={`shrink-0 text-base text-ink ${bold ? "font-bold" : ""}`}>{value}</span>
          </div>
        ))}
      </div>
      {kitty.bill ? (
        <>
          <Small className="mt-2">Tax and service charge are spread across each dish before splitting, so amounts may differ by a few paise.</Small>
          <Link href={`/k/${kitty.slug}?bill=1`} className={`${buttonClass.link} mt-4 block w-fit`}>
            See the scanned bill
          </Link>
        </>
      ) : null}
    </>
  );
}

function Breakdown({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const unfixed = kitty.members.filter((m) => !m.shareFixed).length;
  const rows: [string, string, boolean?][] = kitty.bill
    ? (["veg", "nonveg", "alcohol"] as const)
        .map((c) => kitty.bill!.categories.find((x) => x.category === c))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c): [string, string] =>
          c.memberIds.includes(me.id)
            ? [`${CATEGORY_NAME[c.category]}, split ${c.memberIds.length} ways`, formatRupees(c.perHeadPaise)]
            : [CATEGORY_NAME[c.category], "Not charged"],
        )
    : [
        me.shareFixed
          ? [`Your amount, set by ${kitty.organiser.name}`, formatRupees(me.finalSharePaise ?? 0)]
          : [`Final bill ${formatRupees(kitty.finalBillPaise ?? 0)}, split ${unfixed} ways`, formatRupees(me.finalSharePaise ?? 0)],
      ];
  rows.push(["Your share", formatRupees(me.finalSharePaise ?? 0), true], ["You already paid", formatRupees(me.paidBeforePaise)]);
  return (
    <>
      <div className="mt-3 border border-line bg-surface px-4">
        {rows.map(([label, value, bold], i) => (
          <div key={label} className={`flex min-h-[45px] items-center justify-between gap-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
            <span className="text-base text-text">{label}</span>
            <span className={`text-base text-ink ${bold ? "font-bold" : ""}`}>{value}</span>
          </div>
        ))}
      </div>
      {kitty.bill ? (
        <Link href={`/k/${kitty.slug}?bill=1`} className={`${buttonClass.link} mt-4 block w-fit`}>
          See the scanned bill
        </Link>
      ) : null}
    </>
  );
}

/** "See the scanned bill": the lines Kitty read, never the photos (bill photos are private, spec section 12). */
export function ScannedBill({ kitty }: { kitty: OpenKitty }) {
  const bill = kitty.bill!;
  const tag = { veg: "Veg", nonveg: "Non-veg", alcohol: "Alcohol", unsure: "Unsure" } as const;
  return (
    <Page header={<Header title={kitty.title} left={<Link href={`/k/${kitty.slug}`} aria-label="Back" className="-ml-1 flex h-11 w-9 items-center text-xl text-ink">←</Link>} />}>
      <Title>The scanned bill</Title>
      <Body>What {kitty.organiser.name} checked before Kitty worked out the shares.</Body>
      <ul className="mt-6 border-t border-line">
        {bill.lines.map((l, i) => (
          <li key={i} className="flex min-h-[49px] items-center gap-3 border-b border-line">
            <span className="flex-1 text-base text-ink">{l.label}</span>
            <span className="text-sm text-muted">{tag[l.category]}</span>
            <span className="w-24 text-right text-base text-ink">{formatRupees(l.amountPaise)}</span>
          </li>
        ))}
        <li className="flex min-h-[49px] items-center gap-3 border-b border-line">
          <span className="flex-1 text-base text-text">Tax, service and discounts</span>
          <span className="w-24 text-right text-base text-ink">{formatRupees(bill.extrasPaise)}</span>
        </li>
        <li className="flex min-h-[49px] items-center gap-3">
          <span className="flex-1 text-base font-bold text-ink">Total</span>
          <span className="w-24 text-right text-base font-bold text-ink">{formatRupees(bill.totalPaise)}</span>
        </li>
      </ul>
      <Small className="mt-4">Tax and service charge are spread across each line before splitting.</Small>
    </Page>
  );
}

function TellOrganiser({ kitty }: { kitty: OpenKitty }) {
  const url = whatsAppUrl(kitty.organiser.phone ?? "", `Hi ${kitty.organiser.name}, something looks wrong with my share for ${kitty.title} on Kitty. Can you check?`);
  return url ? (
    <a href={url} className={`${buttonClass.link} mx-auto w-fit`}>
      Something looks wrong, tell {kitty.organiser.name}
    </a>
  ) : (
    <Small className="text-center">Something looks wrong? Message {kitty.organiser.name} directly.</Small>
  );
}

/** Screen 17: the bill came to more for this member. */
export async function TopUp({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const owed = me.topUp!.amountPaise;
  const amount = formatRupees(owed);
  const paid = markPaid.bind(null, kitty.slug);
  const neverPaid = me.paidBeforePaise <= 0;
  return (
    <Page
      header={<Header title="Kitty" right={<NoInstall />} />}
      footer={
        <>
          <form action={paid}>
            <button type="submit" className={buttonClass.primary}>
              I’ve paid
            </button>
          </form>
          <TellOrganiser kitty={kitty} />
        </>
      }
    >
      <p className="text-base leading-6 text-text">
        {me.name}, {neverPaid ? `your share of ${kitty.title}` : `${kitty.title} came to a bit more`}
      </p>
      <p className="mt-0.5 text-[40px] leading-[48px] font-bold text-ink">{neverPaid ? amount : `${amount} more`}</p>
      <p className="mt-1 text-sm leading-[21px] text-text">
        To {kitty.organiser.name}, {kitty.upiId}
      </p>
      <Label className="mt-8">How your share was worked out</Label>
      <Breakdown kitty={kitty} me={me} />
      <Label className="mt-8">Pay {amount}</Label>
      <PayOptions kitty={kitty} amountPaise={owed} markPaid={paid} />
    </Page>
  );
}

/** Screen 18: the bill came to less for this member. */
export function Refund({ kitty, me, upiState }: { kitty: OpenKitty; me: MemberRow; upiState?: string }) {
  const amount = formatRupees(me.refund!.amountPaise);
  const org = kitty.organiser.name;
  return (
    <Page
      header={<Header title="Kitty" right={<NoInstall />} />}
      footer={
        <>
          <form action={gotRefund.bind(null, kitty.slug)}>
            <button type="submit" className={buttonClass.secondary}>
              I’ve got the {amount}
            </button>
          </form>
        </>
      }
    >
      <p className="text-base leading-6 text-text">
        {me.name}, {kitty.title} came to less for you
      </p>
      <p className="mt-0.5 text-[40px] leading-[48px] font-bold text-ink">{amount} back</p>
      <p className="mt-1 text-sm leading-[21px] text-text">{org} sends it by UPI</p>

      <Label className="mt-8">How your share was worked out</Label>
      <Breakdown kitty={kitty} me={me} />

      <form action={saveRefundUpi.bind(null, kitty.slug)} className="mt-6">
        <label htmlFor="refundUpi" className="block text-xs leading-4 font-bold tracking-[1.1px] text-text uppercase">
          Where should {org} send it
        </label>
        <input
          id="refundUpi"
          name="refundUpi"
          defaultValue={me.refundUpiId ?? ""}
          autoComplete="off"
          autoCapitalize="none"
          placeholder="yourname@bank"
          aria-invalid={upiState === "invalid" || undefined}
          className={`mt-1.5 h-[47px] w-full rounded-[3px] border bg-surface px-3 text-base text-ink placeholder:text-muted ${upiState === "invalid" ? "border-danger" : "border-line"}`}
        />
        {upiState === "invalid" ? (
          <p className="mt-1.5 text-sm text-danger" role="alert">
            That doesn’t look like a UPI ID. It should look like name@bank.
          </p>
        ) : upiState === "saved" ? (
          <Small className="mt-[7px]">Sent. {org} will see it.</Small>
        ) : (
          <Small className="mt-[7px]">Only {org} sees this.</Small>
        )}
        <button type="submit" className={`${buttonClass.primary} mt-4`}>
          Send my UPI ID to {org}
        </button>
      </form>
    </Page>
  );
}
