"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    await createClient().auth.signOut();
    window.location.assign("/");
  }

  return <button type="button" disabled={leaving} onClick={() => void signOut()} className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm font-semibold text-zinc-300 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60">{leaving ? "Saindo…" : "Sair da conta"}</button>;
}
