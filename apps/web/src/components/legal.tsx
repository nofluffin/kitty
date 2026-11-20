import Link from "next/link";
import type { ReactNode } from "react";

import { Header, Page } from "@/components/ui";

/** Layout for the privacy policy and terms: plain sections, readable on a phone. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Page
      header={
        <Header
          title="Kitty"
          right={
            <Link href="/" className="text-sm text-ink underline underline-offset-2">
              Home
            </Link>
          }
        />
      }
    >
      <h1 className="text-2xl leading-[30px] font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm leading-[21px] text-text">Last updated {updated}</p>
      <div className="mt-6 space-y-6 text-base leading-6 text-text [&_a]:text-ink [&_a]:underline [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:leading-6 [&_h2]:font-bold [&_h2]:text-ink [&_li]:mt-1 [&_p+p]:mt-3 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </Page>
  );
}

export const CONTACT = "hello@thekitty.app";
export const COMPANY = "Kitty Labs";
