"use client";

import { useState } from "react";
import { useShooAuth } from "@shoojs/react";

function scrambleEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const [domainName, ...tldParts] = domain.split(".");
  const tld = tldParts.join(".");
  const scrambledLocal = local.charAt(0) + "*".repeat(Math.max(1, local.length - 1));
  const scrambledDomain = domainName.charAt(0) + "*".repeat(Math.max(1, domainName.length - 1));
  return `${scrambledLocal}@${scrambledDomain}.${tld}`;
}

function EmailDisplay({ email }: { email: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      onClick={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      className="text-left"
      type="button"
    >
      <span
        className={`inline-block transition-all duration-200 ${
          revealed ? "blur-0" : "blur-sm select-none"
        }`}
      >
        {revealed ? email : scrambleEmail(email)}
      </span>
    </button>
  );
}

export function AccountSection() {
  const { identity, claims, loading, signIn, clearIdentity } = useShooAuth({
    requestPii: true,
  });

  if (loading) {
    return (
      <div className="flex h-9 items-center px-1">
        <span className="text-xs text-stone-500">Loading…</span>
      </div>
    );
  }

  if (!identity?.userId) {
    return (
      <button
        onClick={() => signIn()}
        className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
        type="button"
      >
        Sign in
      </button>
    );
  }

  const name = claims?.name;
  const email = claims?.email;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {name ? (
          <p className="truncate text-sm font-medium text-stone-900">{name}</p>
        ) : email ? (
          <EmailDisplay email={email} />
        ) : (
          <p className="truncate text-sm font-medium text-stone-900">{identity.userId}</p>
        )}
      </div>
      <button
        onClick={() => clearIdentity()}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
