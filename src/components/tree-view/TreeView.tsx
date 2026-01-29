import { TreeHeaderStatus } from "@/components/tree-view/TreeHeaderStatus";
import { TreeScrollableContent } from "@/components/tree-view/TreeScrollableContent";

export function TreeView() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <header className="flex min-h-4 shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Tree view</h2>
        <TreeHeaderStatus />
      </header>

      <div className="-ml-1 min-h-0 flex-1 overflow-y-auto">
        <TreeScrollableContent />
      </div>
    </aside>
  );
}
