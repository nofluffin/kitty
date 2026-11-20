import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Header, NoInstall, Page } from "@/components/ui";
import { claimCookie, loadMemberView, receiptPhotoUrls, touchMember } from "@/server/member-view";

import { Gone, NotReceived, PayShare, PickName, Refund, ScannedBill, TopUp, Waiting } from "./screens";

export const metadata: Metadata = { title: "Kitty" };

/**
 * The member pay page (screens 14, 15, 16, 26, 27). Reads the link and this
 * browser's cookie on every request, so it renders inside Suspense.
 */
export default function MemberPage({ params, searchParams }: PageProps<"/k/[slug]">) {
  return (
    <Suspense
      fallback={
        <Page header={<Header title="Kitty" right={<NoInstall />} />}>
          <p className="text-base text-text">Loading the kitty…</p>
        </Page>
      }
    >
      <MemberScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MemberScreen({ params, searchParams }: PageProps<"/k/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const token = (await cookies()).get(claimCookie(slug).name)?.value;
  const view = await loadMemberView(slug, token);

  if (view.kind !== "open") return <Gone view={view} />;

  const me = view.me;
  if (!me) {
    return (
      <PickName
        kitty={view}
        confirmId={typeof query.confirm === "string" ? query.confirm : undefined}
        notListed={query.missing === "1"}
      />
    );
  }

  await touchMember(me.id);
  if (query.bill === "1" && view.bill) return <ScannedBill kitty={view} photos={await receiptPhotoUrls(view.bill.photoPaths)} />;
  if (me.state === "not_received") return <NotReceived kitty={view} me={me} refInvalid={query.ref === "invalid"} />;
  // After settle up (step 7): a top-up to pay (screen 17) or money coming back (screen 18).
  if (me.topUp && me.topUp.status === "requested") return <TopUp kitty={view} me={me} />;
  if (me.refund && (me.refund.status === "requested" || me.refund.status === "marked")) {
    return <Refund kitty={view} me={me} upiState={typeof query.upi === "string" ? query.upi : undefined} />;
  }
  if (me.state === "unpaid" && me.sharePaise > 0 && view.status === "shared") return <PayShare kitty={view} me={me} />;
  return <Waiting kitty={view} me={me} />;
}
