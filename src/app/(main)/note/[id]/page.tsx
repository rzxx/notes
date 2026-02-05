import { NoteEditor } from "@/components/editor/NoteEditor";

type NotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NotePage({ params }: NotePageProps) {
  const { id } = await params;

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <NoteEditor noteId={id} />
    </section>
  );
}
