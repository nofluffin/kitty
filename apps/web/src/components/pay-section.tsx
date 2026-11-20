"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { buttonClass } from "./ui";

const noSubscribe = () => () => {};

/**
 * Screen 15, step 1. Opens the member's UPI app with the amount filled in.
 * When they come back to the page, ask "Did the payment go through?" so
 * step 2 is one tap (spec section 5).
 */
export function PaySection({
  uri,
  appLinks,
  label,
  markPaid,
  variant = "primary",
}: {
  uri: string;
  appLinks: { gpay: string; phonepe: string; paytm: string };
  label: string;
  markPaid: () => Promise<void>;
  /** Secondary when the QR code leads, since many UPI apps block links to personal UPI IDs. */
  variant?: "primary" | "secondary";
}) {
  const [opened, setOpened] = useState(false);
  const [askBack, setAskBack] = useState(false);
  // Generic upi:// links are unreliable on iPhone, so offer each app's own link too.
  // False on the server, the real answer in the browser, without a hydration mismatch.
  const iPhone = useSyncExternalStore(
    noSubscribe,
    () => /iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    if (!opened) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") setAskBack(true);
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => document.removeEventListener("visibilitychange", onReturn);
  }, [opened]);

  return (
    <>
      {askBack ? (
        <div className="mb-4 border-2 border-ink bg-surface p-4" role="dialog" aria-labelledby="back-title">
          <p id="back-title" className="text-lg leading-[22px] font-bold text-ink">
            Did the payment go through?
          </p>
          <div className="mt-3.5 flex gap-3">
            <form action={markPaid} className="flex-1">
              <button type="submit" className={buttonClass.primary}>
                Yes, I’ve paid
              </button>
            </form>
            <button type="button" onClick={() => setAskBack(false)} className={`${buttonClass.secondary} flex-1`}>
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      <a href={uri} onClick={() => setOpened(true)} className={buttonClass[variant]}>
        {label}
      </a>
      {iPhone ? (
        <div className="mt-3 flex gap-2" aria-label="Open a specific UPI app">
          {(
            [
              ["GPay", appLinks.gpay],
              ["PhonePe", appLinks.phonepe],
              ["Paytm", appLinks.paytm],
            ] as const
          ).map(([name, href]) => (
            <a key={name} href={href} onClick={() => setOpened(true)} className={`${buttonClass.small} flex-1 justify-center`}>
              {name}
            </a>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** "Copy UPI ID" fallback on screen 15. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.small}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          window.prompt("Copy this UPI ID", text);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
