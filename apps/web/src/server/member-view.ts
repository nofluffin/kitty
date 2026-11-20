import "server-only";

import {
  billSplit,
  memberPayState,
  partsProgress,
  type BillCategory,
  type CategorySummary,
  type Diet,
  type MemberPayState,
  type PartPayment,
  type PartsProgress,
  type PaymentStatus,
} from "@kitty/core";

import { db } from "./db";

/** Share slugs are 16 letters and digits. Anything else can't be a real link. */
export const isSlug = (s: string) => /^[A-Za-z0-9]{12,32}$/.test(s);

/** One cookie per kitty, scoped to its link, holding this browser's claim token. */
export const claimCookie = (slug: string) => ({ name: `kitty_${slug}`, path: `/k/${slug}` });

/** A top-up or refund after settle up. */
export interface Adjustment {
  status: PaymentStatus;
  amountPaise: number;
  markedAt: string | null;
}

export interface MemberRow {
  id: string;
  name: string;
  isOrganiser: boolean;
  sortOrder: number;
  sharePaise: number;
  state: MemberPayState;
  /** When they last marked their share as paid. */
  markedAt: string | null;
  claimed: boolean;
  shareFixed: boolean;
  diet: Diet;
  drinks: boolean;
  /** New share after settle up. */
  finalSharePaise: number | null;
  /** Confirmed towards the original share, before any top-up or refund. */
  paidBeforePaise: number;
  refundUpiId: string | null;
  topUp: Adjustment | null;
  refund: Adjustment | null;
  /** Goals paid in parts: every part in date order, and which is next. */
  parts: (PartsProgress & { list: PartPayment[] }) | null;
  /** Who pays this person's share, if someone else does (e.g. a parent). */
  paidById: string | null;
  /** The ids of people this person pays for, in list order. */
  paysForIds: string[];
  /** Asked of this person: their own share plus those they pay for. Zero if someone else pays. */
  askPaise: number;
  /** After settle up: their new share plus those they pay for. */
  finalAskPaise: number | null;
}

export interface OpenKitty {
  kind: "open";
  id: string;
  slug: string;
  title: string;
  status: "shared" | "settling";
  dueDate: string;
  totalPaise: number;
  upiId: string;
  finalBillPaise: number | null;
  kittyKind: "moment" | "goal";
  /** Goals paid in parts. */
  partsCount: number | null;
  /** The checked scanned bill, if the kitty used one: lines only, never the photos (spec section 12). */
  bill: ScannedBillView | null;
  organiser: { name: string; phone: string | null };
  members: MemberRow[];
  /** The member this browser picked, if any. */
  me: MemberRow | null;
}

export interface ScannedBillView {
  lines: { label: string; amountPaise: number; category: BillCategory }[];
  extrasPaise: number;
  totalPaise: number;
  categories: CategorySummary[];
}

export type MemberView =
  | OpenKitty
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "cancelled"; title: string; organiserName: string }
  | { kind: "closed"; title: string; organiserName: string; closedAt: string | null };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Everything the member page needs for one link (screens 14, 15, 16, 26, 27). */
export async function loadMemberView(slug: string, claimToken: string | undefined): Promise<MemberView> {
  if (!isSlug(slug)) return { kind: "not_found" };
  const supabase = db();
  if (!supabase) return { kind: "unavailable" };

  const { data: k, error } = await supabase
    .from("kitties")
    .select(
      "id, title, kind, status, due_date, total_paise, upi_id, closed_at, final_bill_paise, parts_count, organiser:profiles(name, phone), bills(status, extras_paise, created_at, bill_lines(label, raw_text, amount_paise, category, created_at)), members(id, name, is_organiser, sort_order, share_paise, share_fixed, diet, drinks, final_share_paise, refund_upi_id, paid_by_member_id, member_claims(claim_token), payments(kind, direction, status, amount_paise, due_date, marked_at))",
    )
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) return { kind: "unavailable" };
  // A draft hasn't been shared yet, so its link shouldn't work. Don't reveal it exists.
  if (!k || k.status === "draft") return { kind: "not_found" };

  const organiserName = firstName(k.organiser?.name ?? "") || "The organiser";
  if (k.status === "cancelled") return { kind: "cancelled", title: k.title, organiserName };
  if (k.status === "closed") return { kind: "closed", title: k.title, organiserName, closedAt: k.closed_at };

  let meId: string | null = null;
  const members: MemberRow[] = k.members.map((m) => {
    const shares = m.payments.filter((p) => p.direction === "in" && (p.kind === "share" || p.kind === "part"));
    const tokens = m.member_claims.map((c) => c.claim_token);
    if (claimToken && tokens.includes(claimToken)) meId = m.id;
    const marked = shares.map((p) => p.marked_at).filter((t): t is string => !!t).sort();
    const adjustment = (kind: "topup" | "refund"): Adjustment | null => {
      const p = m.payments.find((x) => x.kind === kind);
      return p ? { status: p.status as PaymentStatus, amountPaise: p.amount_paise, markedAt: p.marked_at } : null;
    };
    const partList: PartPayment[] = m.payments
      .filter((p) => p.kind === "part" && p.due_date)
      .map((p) => ({ amountPaise: p.amount_paise, dueDate: p.due_date!, status: p.status as PaymentStatus }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const topUp = adjustment("topup");
    const refund = adjustment("refund");
    // Nothing asked of them (a zero share, or someone else pays): nothing to pay.
    const shareState = shares.length === 0 ? "paid" : memberPayState(shares.map((p) => p.status as PaymentStatus));
    return {
      id: m.id,
      name: m.name,
      isOrganiser: m.is_organiser,
      sortOrder: m.sort_order,
      sharePaise: m.share_paise,
      // After settle up, a top-up decides how the member stands: their original request was
      // written off and replaced by it. A refund means they paid, so they count as paid.
      state: topUp ? memberPayState([topUp.status]) : shareState,
      markedAt: topUp?.markedAt ?? marked.at(-1) ?? null,
      claimed: tokens.length > 0,
      shareFixed: m.share_fixed,
      diet: m.diet,
      drinks: m.drinks,
      finalSharePaise: m.final_share_paise,
      paidBeforePaise: shares.filter((p) => p.status === "confirmed").reduce((sum, p) => sum + p.amount_paise, 0),
      refundUpiId: m.refund_upi_id,
      topUp,
      refund,
      parts: k.parts_count && partList.length > 0 ? { ...partsProgress(partList), list: partList } : null,
      paidById: m.paid_by_member_id,
      paysForIds: [],
      askPaise: 0,
      finalAskPaise: null,
    };
  });
  // Paying for someone else: the payer is asked for the group, and the people they
  // pay for stand wherever the payer stands.
  for (const m of members) {
    const group = members.filter((x) => x.id === m.id || x.paidById === m.id);
    m.paysForIds = [...group].filter((x) => x.id !== m.id).sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.id);
    m.askPaise = m.paidById ? 0 : group.reduce((sum, x) => sum + x.sharePaise, 0);
    m.finalAskPaise = m.paidById || m.finalSharePaise === null ? null : group.reduce((sum, x) => sum + (x.finalSharePaise ?? 0), 0);
  }
  for (const m of members) {
    const payer = m.paidById ? members.find((x) => x.id === m.paidById) : null;
    if (payer) m.state = payer.state;
  }

  const confirmed = [...k.bills].filter((b) => b.status === "confirmed").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  let bill: ScannedBillView | null = null;
  if (confirmed) {
    const lines = [...confirmed.bill_lines]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((l, i) => ({ id: String(i), label: l.label || l.raw_text, amountPaise: l.amount_paise, category: l.category as BillCategory }));
    const split = billSplit(lines, confirmed.extras_paise, [...members].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => ({ id: m.id, diet: m.diet, drinks: m.drinks })));
    bill = {
      lines: lines.map(({ label, amountPaise, category }) => ({ label, amountPaise, category })),
      extrasPaise: confirmed.extras_paise,
      totalPaise: lines.reduce((s, l) => s + l.amountPaise, 0) + confirmed.extras_paise,
      categories: split.ok ? split.value.categories : [],
    };
  }

  return {
    kind: "open",
    bill,
    id: k.id,
    slug,
    title: k.title,
    status: k.status,
    dueDate: k.due_date,
    totalPaise: k.total_paise,
    upiId: k.upi_id,
    finalBillPaise: k.final_bill_paise,
    kittyKind: k.kind,
    partsCount: k.parts_count,
    organiser: { name: organiserName, phone: k.organiser?.phone ?? null },
    members,
    me: members.find((m) => m.id === meId) ?? null,
  };
}

/** Remember that a claimed member opened the link (the feed shows "opened the link"). */
export async function touchMember(memberId: string): Promise<void> {
  await db()?.from("members").update({ last_opened_at: new Date().toISOString() }).eq("id", memberId);
}
