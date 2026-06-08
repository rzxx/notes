"use client";

import { useShooAuth } from "@shoojs/react";

export default function ShooCallback() {
  useShooAuth();
  return <p className="text-stone-600">Signing in…</p>;
}
