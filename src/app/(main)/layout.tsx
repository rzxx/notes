import { TreeView } from "@/components/tree-view";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full bg-stone-100 text-stone-900">
      <main className="flex h-full w-full gap-4 px-4 py-8">
        <aside className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <header className="shrink-0">
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Tree view
            </h2>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TreeView />
          </div>
        </aside>

        <section className="h-full min-w-0 flex-1 overflow-y-auto">{children}</section>
      </main>
    </div>
  );
}
