import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Member page building blocks, sized from the wireframes (390 pt phone):
 * 56 px header, 20 px gutters, 51 px buttons, 47 px inputs, 1 px #7a7a7a lines.
 */

export function Page({ header, children, footer }: { header: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-page">
      {header}
      <main className="flex flex-1 flex-col px-5 pt-6 pb-6">{children}</main>
      {footer ? <footer className="flex flex-col gap-4 px-5 pt-4 pb-5">{footer}</footer> : null}
    </div>
  );
}

/** Top bar: "Kitty" and "WEB PAGE, NO INSTALL", or a kitty name with something on the right. */
export function Header({ title, right, left }: { title: string; right?: ReactNode; left?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      {left}
      <h1 className={`flex-1 truncate font-bold text-ink ${left ? "text-lg" : "text-xl"}`}>{title}</h1>
      {right}
    </header>
  );
}

export function NoInstall() {
  return <span className="text-xs font-bold tracking-[1.1px] text-text uppercase">Web page, no install</span>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-[5px] text-2xl leading-[30px] font-bold text-ink">{children}</h2>;
}

export function Body({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-base leading-6 text-text">{children}</p>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-4 font-bold tracking-[1.1px] text-text uppercase ${className}`}>{children}</p>;
}

export function Small({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-4 text-muted ${className}`}>{children}</p>;
}

const buttonBase =
  "flex h-[51px] w-full items-center justify-center border px-4 text-base transition-opacity active:opacity-80 disabled:opacity-40";
export const buttonClass = {
  primary: `${buttonBase} border-action bg-action font-bold text-white`,
  secondary: `${buttonBase} border-line bg-surface text-ink`,
  small: "inline-flex h-11 items-center border border-line bg-surface px-[15px] text-sm text-ink active:opacity-80",
  link: "text-sm leading-[21px] text-ink underline underline-offset-2",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

/** Dashed explanation box. */
export function Note({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-line px-[13px] py-3.5 text-sm leading-[21px] text-text">{children}</div>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full bg-track" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 bg-ink" style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
    </div>
  );
}

/** Screens 16 and 27: invite members to organise their own kitty. */
export function GetKitty() {
  return (
    <div className="border border-dashed border-line px-4 py-5">
      <p className="text-base leading-[22px] font-bold text-ink">Your turn to organise next?</p>
      <p className="mt-2.5 text-sm leading-[21px] text-text">Start your own kitty and get paid before the bill arrives.</p>
      <Link href="/" className={`${buttonClass.small} mt-3.5 font-bold`}>
        Get Kitty
      </Link>
    </div>
  );
}
