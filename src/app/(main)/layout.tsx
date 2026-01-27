import { TreeView } from "@/components/tree-view";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen max-w-screen bg-stone-100 px-6 py-10 text-stone-900">
      <main className="mx-auto flex w-full gap-4">
        <aside className="w-80 shrink-0">
          <TreeView />
        </aside>

        <section className="flex-1">{children}</section>
      </main>
    </div>
  );
}
