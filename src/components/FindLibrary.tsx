"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Lets a visitor jump to their school's public catalog by school code. */
export function FindLibrary() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const c = code.trim().toLowerCase(); if (c) router.push(`/t/${encodeURIComponent(c)}`); }}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row" role="search" aria-label="Find your library"
    >
      <label htmlFor="school-code" className="sr-only">School code</label>
      <input id="school-code" value={code} onChange={(e) => setCode(e.target.value)} className="input" placeholder="School code, e.g. demo-uni" autoComplete="off" />
      <button className="btn-outline shrink-0">Browse catalog</button>
    </form>
  );
}
