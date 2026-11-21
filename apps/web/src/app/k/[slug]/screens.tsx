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

/** Screen 16's status line under each name (wording from Raj, 20 Nov 2026). */
function statusText(m: MemberRow, kitty: OpenKitty): string {
  const org = kitty.organiser.name;
  if (m.paidById) return `${kitty.members.find((x) => x.id === m.paidById)?.name ?? "Someone"} pays for them`;
  if (m.isOrganiser) return "Organiser";
  if (m.state === "paid") return "Paid, confirmed ✓";
  if (m.state === "waiting") return `Paid, waiting for ${org} to confirm`;
  if (m.state === "not_received") return `${org} hasn’t received it yet`;
  return "Not paid yet";
}

/** Food and drink as small tags next to a name, so the group sees why amounts differ. */
function DietTags({ m }: { m: MemberRow }) {
  const tag = "inline-flex h-5 items-center rounded-[3px] border border-line px-1.5 text-xs leading-4 text-text";
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {/* Raj, 21 Nov 2026: Non-Veg in title case; Alcohol or No Alcohol. */}
      <span className={tag}>{m.diet === "veg" ? "Veg" : "Non-Veg"}</span>
      <span className={tag}>{m.drinks ? "Alcohol" : "No Alcohol"}</span>
    </span>
  );
}

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

export function PickName({
  kitty,
  confirmId,
  notListed,
  forId,
}: {
  kitty: OpenKitty;
  confirmId?: string;
  notListed?: boolean;
  /** A personal link from a nudge (?for=<member>): that person's name is ready to tap. */
  forId?: string;
}) {
  // What each payer is asked for (someone paying for a child is asked for both).
  const shares = kitty.members.filter((m) => !m.paidById).map((m) => m.askPaise);
  const equal = isEqualSplit(shares);
  const progress = payProgress(kitty.members);
  const claim = claimName.bind(null, kitty.slug);
  const confirming = kitty.members.find((m) => m.id === confirmId && !m.isOrganiser && m.state !== "paid");
  const forMe = kitty.members.find((m) => m.id === forId && !m.isOrganiser && !m.paidById && (m.state !== "paid" || hasOpenRefund(m)));

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

      {forMe ? (
        <form action={claim} className="mt-6">
          <input type="hidden" name="memberId" value={forMe.id} />
          <button type="submit" className={buttonClass.primary}>
            I’m {forMe.name}, continue
          </button>
        </form>
      ) : null}

      <h2 className="mt-6 text-xl leading-6 font-bold text-ink">{forMe ? `Not ${forMe.name}? Pick your name` : "Who are you?"}</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {/* People paid for by someone else never pay themselves, so they aren't listed. */}
        {pickList(kitty.members.filter((m) => !m.paidById)).map((m) =>
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
                  className={`flex h-[52px] w-full items-center justify-between border bg-surface px-4 text-left active:opacity-80 ${m.id === forMe?.id ? "border-ink" : "border-line"}`}
                >
                  <span className="text-base text-ink">{m.name}</span>
                  <span className="text-sm text-muted">
                    {hasOpenRefund(m)
                      ? "Money back"
                      : m.state === "waiting"
                        ? `Waiting for ${kitty.organiser.name}`
                        : "→"}
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
  const owed = next?.amountPaise ?? me.askPaise;
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
        Your {parts.total} parts, {formatRupees(me.askPaise)} in all
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
  const amount = formatRupees(me.askPaise);
  const org = kitty.organiser.name;
  const body = me.refund?.status === "confirmed"
    ? `Your ${formatRupees(me.refund.amountPaise)} back is sorted. You’re square.`
    : me.topUp?.status === "marked"
      ? `You marked ${formatRupees(me.topUp.amountPaise)} as paid. ${org} will confirm once it lands.`
      : me.topUp?.status === "confirmed"
        ? `${org} confirmed your ${formatRupees(me.topUp.amountPaise)}. You’re square.`
        : kitty.status === "settling" && !me.topUp && !me.refund
          ? `Your share came to exactly what you paid. You’re square.`
          : me.askPaise === 0
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

      {/* Raj, 20 Nov 2026: an overview of your own share, with the group list tucked away. */}
      <Card className="mt-6">
        <p className="text-sm leading-[21px] text-text">{me.paysForIds.length > 0 ? "Your share, with those you pay for" : "Your share"}</p>
        <p className="mt-0.5 text-[32px] leading-10 font-bold text-ink">{formatRupees(me.finalAskPaise ?? me.askPaise)}</p>
        <p className="mt-1 text-sm leading-[21px] text-text">{statusText(me, kitty)}</p>
      </Card>

      <Label className="mt-8">How your share was worked out</Label>
      {kitty.status === "settling" && me.finalSharePaise !== null ? (
        <Breakdown kitty={kitty} me={me} />
      ) : (
        <ShareBreakdown kitty={kitty} me={me} showEveryone={false} />
      )}

      <Card className="mt-8">
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

      <details className="group mt-4">
        <summary className={`${buttonClass.link} w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <span className="group-open:hidden">See who’s paid</span>
          <span className="hidden group-open:inline">Hide who’s paid</span>
        </summary>
        <ul className="mt-3 border-t border-line">
          {statusList(kitty.members, me.id).map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 border-b border-line py-3">
              <div>
                <p className="text-base leading-6 text-ink">
                  {m.id === me.id ? "You" : m.name}
                  <DietTags m={m} />
                </p>
                <p className={`mt-0.5 text-sm leading-[21px] ${m.state === "paid" && !m.paidById ? "text-muted" : "text-text"}`}>
                  {statusText(m, kitty)}
                </p>
              </div>
              <span className="shrink-0 text-base leading-6 text-ink">
                {formatRupees(m.paidById ? (m.finalSharePaise ?? m.sharePaise) : (m.finalAskPaise ?? m.askPaise))}
              </span>
            </li>
          ))}
        </ul>
      </details>

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
  const owed = me.topUp ? me.topUp.amountPaise : (me.parts?.next?.amountPaise ?? me.askPaise);
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

const CATEGORY_NAME = { veg: "Veg dishes", nonveg: "Non-Veg dishes", alcohol: "Alcohol" } as const;

interface BreakdownRow {
  label: string;
  value: string;
  bold?: boolean;
  /** Scanned bills: the dishes behind a veg, non-veg or alcohol line. */
  dishes?: { label: string; amountPaise: number }[];
}

/** Veg, non-veg and alcohol from a scanned bill, each with its dishes (decided with Raj, 20 Nov 2026). */
function categoryRows(kitty: OpenKitty, me: MemberRow): BreakdownRow[] {
  const bill = kitty.bill!;
  return (["veg", "nonveg", "alcohol"] as const)
    .map((c) => bill.categories.find((x) => x.category === c))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({
      ...(c.memberIds.includes(me.id)
        ? { label: `${CATEGORY_NAME[c.category]} ${formatRupees(c.totalPaise)}, split ${c.memberIds.length} ways`, value: formatRupees(c.perHeadPaise) }
        : { label: CATEGORY_NAME[c.category], value: "Not charged" }),
      dishes: bill.lines.filter((l) => l.category === c.category),
    }));
}

function BreakdownCard({ rows }: { rows: BreakdownRow[] }) {
  return (
    <div className="mt-3 border border-line bg-surface px-4">
      {rows.map((r, i) => (
        <div key={r.label} className={`py-3 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-base text-text">{r.label}</span>
            <span className={`shrink-0 text-base text-ink ${r.bold ? "font-bold" : ""}`}>{r.value}</span>
          </div>
          {r.dishes && r.dishes.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {r.dishes.map((d, j) => (
                <li key={j} className="flex justify-between gap-3 text-sm leading-[21px] text-muted">
                  <span>{d.label}</span>
                  <span className="shrink-0">{formatRupees(d.amountPaise)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ScannedNote({ kitty }: { kitty: OpenKitty }) {
  if (!kitty.bill) return null;
  return (
    <>
      {kitty.bill.extrasPaise !== 0 ? (
        <Small className="mt-2">
          Tax, service and discounts ({formatRupees(kitty.bill.extrasPaise)}) are spread across each dish before splitting, so amounts may differ by a few paise.
        </Small>
      ) : null}
      <Link href={`/k/${kitty.slug}?bill=1`} className={`${buttonClass.link} mt-4 block w-fit`}>
        View receipt
      </Link>
    </>
  );
}

/** How one person's share was worked out, before any settle up. */
function personRows(kitty: OpenKitty, p: MemberRow, isMe: boolean): BreakdownRow[] {
  const org = kitty.organiser.name;
  const fixed = kitty.members.filter((m) => m.shareFixed);
  const fixedTotal = fixed.reduce((sum, m) => sum + m.sharePaise, 0);
  const splitWays = kitty.members.length - fixed.length;
  const total = { label: `Total ${formatRupees(kitty.totalPaise)}`, value: "" };
  const whose = isMe ? "Your" : `${p.name}’s`;
  if (kitty.bill) return [...categoryRows(kitty, p), { label: `${whose} share`, value: formatRupees(p.sharePaise), bold: true }];
  if (p.shareFixed) return [total, { label: `${whose} amount, set by ${org}`, value: formatRupees(p.sharePaise) }];
  if (fixed.length > 0) {
    return [
      total,
      { label: `Set by ${org} for ${fixed.map((m) => m.name).join(", ")}`, value: `−${formatRupees(fixedTotal)}` },
      { label: `The rest, split ${splitWays} ways`, value: formatRupees(p.sharePaise) },
    ];
  }
  return [{ label: `Total ${formatRupees(kitty.totalPaise)}, split ${kitty.members.length} ways`, value: formatRupees(p.sharePaise) }];
}

/** Screen 15: how the share being asked for was worked out, for you and anyone you pay for. */
function ShareBreakdown({ kitty, me, showEveryone = true }: { kitty: OpenKitty; me: MemberRow; showEveryone?: boolean }) {
  const paysFor = me.paysForIds.map((id) => kitty.members.find((m) => m.id === id)!);
  return (
    <>
      {paysFor.length === 0 ? (
        <BreakdownCard rows={personRows(kitty, me, true)} />
      ) : (
        <>
          {[me, ...paysFor].map((p, i) => (
            <div key={p.id} className={i === 0 ? "mt-3" : "mt-5"}>
              <p className="text-sm leading-[21px] font-bold text-ink">{i === 0 ? "For you" : `For ${p.name}`}</p>
              <BreakdownCard rows={personRows(kitty, p, i === 0)} />
            </div>
          ))}
          <BreakdownCard rows={[{ label: `For you and ${paysFor.map((p) => p.name).join(", ")}`, value: formatRupees(me.askPaise), bold: true }]} />
        </>
      )}
      <ScannedNote kitty={kitty} />
      {showEveryone ? <EveryonesShare kitty={kitty} me={me} /> : null}
    </>
  );
}

/** Everyone's amount, so the group can see the whole split (decided with Raj, 20 Nov 2026). */
function EveryonesShare({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const list = [...kitty.members].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.sortOrder - b.sortOrder));
  return (
    <>
      <Label className="mt-8">Everyone’s share</Label>
      <ul className="mt-3 border-t border-line">
        {list.map((m) => (
          <li key={m.id} className="flex min-h-[45px] items-center justify-between gap-3 border-b border-line">
            <span className="text-base text-ink">
              {m.id === me.id ? "You" : m.isOrganiser ? `${m.name} (organiser)` : m.name}
              <DietTags m={m} />
              {m.paidById ? (
                <span className="text-text">{m.paidById === me.id ? ", you pay" : `, ${kitty.members.find((x) => x.id === m.paidById)?.name} pays`}</span>
              ) : null}
            </span>
            <span className="text-base text-text">{formatRupees(m.sharePaise)}</span>
          </li>
        ))}
        <li className="flex min-h-[45px] items-center justify-between gap-3">
          <span className="text-base font-bold text-ink">Total</span>
          <span className="text-base font-bold text-ink">{formatRupees(kitty.totalPaise)}</span>
        </li>
      </ul>
    </>
  );
}

/** "How your share was worked out" (screens 17 and 18): by category for a scanned bill, otherwise the typed split. */
function Breakdown({ kitty, me }: { kitty: OpenKitty; me: MemberRow }) {
  const unfixed = kitty.members.filter((m) => !m.shareFixed).length;
  const rows: BreakdownRow[] = kitty.bill
    ? categoryRows(kitty, me)
    : [
        me.shareFixed
          ? { label: `Your amount, set by ${kitty.organiser.name}`, value: formatRupees(me.finalSharePaise ?? 0) }
          : { label: `Final bill ${formatRupees(kitty.finalBillPaise ?? 0)}, split ${unfixed} ways`, value: formatRupees(me.finalSharePaise ?? 0) },
      ];
  rows.push(
    // Paying for someone else: their new shares, then the total for the group.
    ...me.paysForIds.map((id) => {
      const p = kitty.members.find((m) => m.id === id)!;
      return { label: `${p.name}’s share`, value: formatRupees(p.finalSharePaise ?? 0) };
    }),
    {
      label: me.paysForIds.length > 0 ? "Your share and theirs" : "Your share",
      value: formatRupees(me.finalAskPaise ?? me.finalSharePaise ?? 0),
      bold: true,
    },
    { label: "You already paid", value: formatRupees(me.paidBeforePaise) },
  );
  return (
    <>
      <BreakdownCard rows={rows} />
      <ScannedNote kitty={kitty} />
    </>
  );
}

/**
 * "View receipt": the bill photo and the lines Kitty read. Decided with Raj, 20 Nov 2026:
 * people with the kitty link may see the photo (it was lines only before). The photo
 * links expire after 10 minutes.
 */
export function ScannedBill({ kitty, photos }: { kitty: OpenKitty; photos: string[] }) {
  const bill = kitty.bill!;
  const tag = { veg: "Veg", nonveg: "Non-Veg", alcohol: "Alcohol", unsure: "Unsure" } as const;
  return (
    <Page header={<Header title={kitty.title} left={<Link href={`/k/${kitty.slug}`} aria-label="Back" className="-ml-1 flex h-11 w-9 items-center text-xl text-ink">←</Link>} />}>
      <Title>The receipt</Title>
      <Body>The bill {kitty.organiser.name} scanned, and the lines Kitty read from it.</Body>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived storage links, nothing to optimise
        <img key={i} src={src} alt={`Photo ${i + 1} of the bill`} className="mt-4 w-full border border-line" />
      ))}
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
