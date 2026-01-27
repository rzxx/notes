import { TreeView } from "@/components/TreeView";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl gap-6">
        <aside className="w-80 shrink-0">
          <TreeView />
        </aside>

        <section className="flex-1 space-y-6">{children}</section>
      </main>
    </div>
  );
}
