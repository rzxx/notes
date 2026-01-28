import { TreeView } from "@/components/tree-view";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full bg-stone-100 text-stone-900">
      <main className="flex h-full w-full gap-4 px-4 py-8">
        <TreeView />

        <section className="h-full min-w-0 flex-1 overflow-y-auto">{children}</section>
      </main>
    </div>
  );
}
