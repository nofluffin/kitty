import type { Metadata } from "next";
import { Suspense } from "react";

import { Body, buttonClass, Header, NoInstall, Page, Small, Title } from "@/components/ui";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "A shared group, Kitty" };

/**
 * "Share group" links (Raj, 20 Nov 2026). Opens the Kitty app to add the group;
 * on a computer, the desktop app does the same. Only the group's name and who
 * shared it show here: the people in it appear once it's added.
 */
export default function SharedGroupPage({ params, searchParams }: PageProps<"/g/[token]">) {
  return (
    <Suspense fallback={<Page header={<Header title="Kitty" right={<NoInstall />} />}>{null}</Page>}>
      <SharedGroup params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SharedGroup({ params }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const supabase = db();
  const { data: g } =
    supabase && /^[A-Za-z0-9]{12,32}$/.test(token)
      ? await supabase.from("groups").select("name, created_by_name").eq("share_token", token).maybeSingle()
      : { data: null };

  return (
    <Page header={<Header title="Kitty" />}>
      {g ? (
        <>
          <Title>{g.created_by_name || "A friend"} shared the group {g.name}</Title>
          <Body>Add it to your Kitty to start kitties with everyone in it, in one tap.</Body>
          <div className="mt-6 flex flex-col gap-3">
            <a href={`kitty://join-group/${token}`} className={buttonClass.primary}>
              Add it in the Kitty app
            </a>
            <a href={`https://app.thekitty.app/join-group/${token}`} className={buttonClass.secondary}>
              On a computer? Add it on app.thekitty.app
            </a>
          </div>
          <Small className="mt-4">You need a Kitty organiser account. Friends who only pay don’t need one.</Small>
        </>
      ) : (
        <>
          <Title>This group link doesn’t work</Title>
          <Body>It may have been mistyped, or everyone has left the group. Ask for a new link.</Body>
        </>
      )}
    </Page>
  );
}
