"use client";

import { useShooAuth } from "@shoojs/react";
import { TreeHeaderActions } from "@/components/tree-view/TreeHeaderActions";
import { TreeHeaderSpinner } from "@/components/tree-view/TreeHeaderSpinner";
import { TreeHeaderStatus } from "@/components/tree-view/TreeHeaderStatus";
import { TreeScrollableContent } from "@/components/tree-view/TreeScrollableContent";
import { AccountSection } from "@/components/auth/AccountSection";

export function TreeView() {
  const { identity, loading } = useShooAuth();
  const isAuthenticated = !loading && Boolean(identity?.userId);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <header className="flex min-h-4 shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Notes</h2>
          <TreeHeaderSpinner />
        </div>
        <TreeHeaderActions />
      </header>

      {isAuthenticated ? (
        <div className="-ml-1 min-h-0 flex-1 overflow-y-auto">
          <TreeScrollableContent />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-sm text-stone-500">Sign in to view your notes</p>
        </div>
      )}

      <div className="shrink-0">
        <TreeHeaderStatus />
      </div>

      <div className="shrink-0 border-t border-stone-200 pt-2">
        <AccountSection />
      </div>
    </aside>
  );
}
