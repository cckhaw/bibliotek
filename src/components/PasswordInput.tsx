"use client";
import { useState } from "react";

/** Password field with a show/hide (eye) toggle. Keyboard- and screen-reader-accessible. */
export function PasswordInput({
  id, name, required, placeholder, autoComplete = "current-password", minLength,
}: { id: string; name: string; required?: boolean; placeholder?: string; autoComplete?: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} className="input pr-12" required={required} placeholder={placeholder}
        autoComplete={autoComplete} minLength={minLength} spellCheck={false} autoCapitalize="none" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:text-white">
        {show ? (
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9 4.5 10 7a11.7 11.7 0 0 1-3.2 4.2M6.6 6.7C4.2 8.2 2.6 10.5 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.6-1.2" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
