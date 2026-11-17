import { formatRupees } from "@kitty/core";

// Placeholder until step 5 (member pay page) replaces it.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Kitty</h1>
      <p className="mt-2 text-zinc-600">
        Member pay page placeholder. Core is wired in: {formatRupees(103167)}
      </p>
    </main>
  );
}
