import { TreeHeaderStatus } from "@/components/tree-view/TreeHeaderStatus";
import { TreeScrollableContent } from "@/components/tree-view/TreeScrollableContent";

export function TreeView() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <header className="shrink-0">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Tree view</h2>
      </header>

      <div className="shrink-0">
        <TreeHeaderStatus />
      </div>

      <div className="-ml-1 min-h-0 flex-1 overflow-y-auto">
        <TreeScrollableContent />
      </div>
    </aside>
  );
}
