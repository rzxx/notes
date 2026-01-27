type NotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NotePage({ params }: NotePageProps) {
  const { id } = await params;

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <h1 className="text-lg font-semibold text-stone-900">Note {id}</h1>
      <p className="mt-2 text-sm text-stone-600">Note content placeholder.</p>
    </section>
  );
}
