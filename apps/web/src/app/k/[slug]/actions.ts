"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isValidUpiId, normaliseUpiId } from "@kitty/core";

import { db } from "@/server/db";
import { claimCookie, isSlug } from "@/server/member-view";

/*
 * Member page actions (spec sections 5 and 7). These are public endpoints:
 * every one re-checks the link and reads who the member is from their
 * httpOnly cookie, never from anything the page sends.
 */

const ONE_YEAR = 60 * 60 * 24 * 365;

/** The kitty for a link, only if it's open for paying. */
async function openKitty(slug: string) {
  const supabase = db();
  if (!supabase || !isSlug(slug)) return null;
  const { data } = await supabase.from("kitties").select("id, status").eq("share_slug", slug).maybeSingle();
  return data && (data.status === "shared" || data.status === "settling") ? { supabase, kittyId: data.id } : null;
}

/** The member this browser claimed on this kitty, from the cookie. */
async function claimedMember(slug: string) {
  const open = await openKitty(slug);
  if (!open) return null;
  const token = (await cookies()).get(claimCookie(slug).name)?.value;
  if (!token) return null;
  const { data } = await open.supabase
    .from("member_claims")
    .select("member_id, members!inner(kitty_id)")
    .eq("claim_token", token)
    .maybeSingle();
  if (!data || data.members.kitty_id !== open.kittyId) return null;
  return { ...open, memberId: data.member_id, token };
}

/** Screen 14: "Who are you?" Picking a name sets a cookie on this browser. */
export async function claimName(slug: string, formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const confirmed = formData.get("confirmed") === "yes";
  const open = await openKitty(slug);
  if (!open) redirect(`/k/${slug}`);

  const { data: member } = await open.supabase
    .from("members")
    .select("id, kitty_id, is_organiser, member_claims(claim_token), payments(status, kind, direction)")
    .eq("id", memberId)
    .maybeSingle();
  // Paid names can't be picked, unless money is coming back to them after settle up.
  const refundOpen = member?.payments.some((p) => p.kind === "refund" && (p.status === "requested" || p.status === "marked"));
  const paid =
    !refundOpen &&
    member?.payments.some((p) => p.direction === "in" && (p.kind === "share" || p.kind === "part")) &&
    member.payments
      .filter((p) => p.direction === "in" && (p.kind === "share" || p.kind === "part"))
      .every((p) => p.status === "confirmed");
  if (!member || member.kitty_id !== open.kittyId || member.is_organiser || paid) redirect(`/k/${slug}`);

  // Claiming is a convenience, not security (spec section 7). If the name was picked on
  // another browser, ask "Is this you?" first, then let them continue.
  const cookieStore = await cookies();
  const mine = cookieStore.get(claimCookie(slug).name)?.value;
  const elsewhere = member.member_claims.some((c) => c.claim_token !== mine);
  if (elsewhere && !confirmed) redirect(`/k/${slug}?confirm=${member.id}`);

  const token = randomBytes(32).toString("base64url");
  const { error } = await open.supabase.from("member_claims").insert({ member_id: member.id, claim_token: token });
  if (error) redirect(`/k/${slug}`);
  cookieStore.set(claimCookie(slug).name, token, {
    path: claimCookie(slug).path,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
  });
  redirect(`/k/${slug}`);
}

/** "Not you?": forget the name picked on this browser. */
export async function forgetMe(slug: string) {
  const me = await claimedMember(slug);
  if (me) await me.supabase.from("member_claims").delete().eq("claim_token", me.token);
  (await cookies()).delete({ name: claimCookie(slug).name, path: claimCookie(slug).path });
  redirect(`/k/${slug}`);
}

/** Screen 15 "I've paid", or "Yes" to "Did the payment go through?". */
export async function markPaid(slug: string) {
  const me = await claimedMember(slug);
  if (me) {
    // Only the payment being paid now: for a goal in parts that's the earliest open part,
    // so later parts stay open until their turn.
    const { data: next } = await me.supabase
      .from("payments")
      .select("id")
      .eq("member_id", me.memberId)
      .eq("direction", "in")
      .in("kind", ["share", "part", "topup"])
      .in("status", ["requested", "not_received"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) await me.supabase.from("payments").update({ status: "marked" }).eq("id", next.id);
    // The push notification to the organiser comes with step 6.
  }
  redirect(`/k/${slug}`);
}

/** Screen 26: "Send the reference to Rohan". UPI references are 12 digits. */
export async function sendReference(slug: string, formData: FormData) {
  const ref = String(formData.get("upiRef") ?? "").replace(/\s+/g, "");
  if (!/^\d{12}$/.test(ref)) redirect(`/k/${slug}?ref=invalid`);
  const me = await claimedMember(slug);
  if (me) {
    await me.supabase
      .from("payments")
      .update({ status: "marked", upi_ref: ref })
      .eq("member_id", me.memberId)
      .eq("direction", "in")
      .in("kind", ["share", "part", "topup"])
      .eq("status", "not_received");
  }
  redirect(`/k/${slug}`);
}

/** Screen 18: "Send my UPI ID to Rohan". Only the organiser sees it. */
export async function saveRefundUpi(slug: string, formData: FormData) {
  const upi = normaliseUpiId(String(formData.get("refundUpi") ?? ""));
  if (!isValidUpiId(upi)) redirect(`/k/${slug}?upi=invalid`);
  const me = await claimedMember(slug);
  if (me) await me.supabase.from("members").update({ refund_upi_id: upi }).eq("id", me.memberId);
  redirect(`/k/${slug}?upi=saved`);
}

/** Screen 18: "I've got the ₹600". Decided 20 Nov 2026: this or the organiser's "Mark sent" finishes a refund. */
export async function gotRefund(slug: string) {
  const me = await claimedMember(slug);
  if (me) {
    await me.supabase
      .from("payments")
      .update({ status: "confirmed" })
      .eq("member_id", me.memberId)
      .eq("kind", "refund")
      .in("status", ["requested", "marked"]);
  }
  redirect(`/k/${slug}`);
}
