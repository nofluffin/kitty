import "server-only";

import { memberPayState, type MemberPayState, type PaymentStatus } from "@kitty/core";

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
  /** New share after settle up. */
  finalSharePaise: number | null;
  /** Confirmed towards the original share, before any top-up or refund. */
  paidBeforePaise: number;
  refundUpiId: string | null;
  topUp: Adjustment | null;
  refund: Adjustment | null;
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
  organiser: { name: string; phone: string | null };
  members: MemberRow[];
  /** The member this browser picked, if any. */
  me: MemberRow | null;
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
      "id, title, status, due_date, total_paise, upi_id, closed_at, final_bill_paise, organiser:profiles(name, phone), members(id, name, is_organiser, sort_order, share_paise, share_fixed, final_share_paise, refund_upi_id, member_claims(claim_token), payments(kind, direction, status, amount_paise, marked_at))",
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
    const topUp = adjustment("topup");
    const refund = adjustment("refund");
    const shareState = m.share_paise === 0 ? "paid" : memberPayState(shares.map((p) => p.status as PaymentStatus));
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
      finalSharePaise: m.final_share_paise,
      paidBeforePaise: shares.filter((p) => p.status === "confirmed").reduce((sum, p) => sum + p.amount_paise, 0),
      refundUpiId: m.refund_upi_id,
      topUp,
      refund,
    };
  });

  return {
    kind: "open",
    id: k.id,
    slug,
    title: k.title,
    status: k.status,
    dueDate: k.due_date,
    totalPaise: k.total_paise,
    upiId: k.upi_id,
    finalBillPaise: k.final_bill_paise,
    organiser: { name: organiserName, phone: k.organiser?.phone ?? null },
    members,
    me: members.find((m) => m.id === meId) ?? null,
  };
}

/** Remember that a claimed member opened the link (the feed shows "opened the link"). */
export async function touchMember(memberId: string): Promise<void> {
  await db()?.from("members").update({ last_opened_at: new Date().toISOString() }).eq("id", memberId);
}
