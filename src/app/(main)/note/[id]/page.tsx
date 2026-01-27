type NotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NotePage({ params }: NotePageProps) {
  const { id } = await params;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h1 className="text-lg font-semibold text-zinc-900">Note {id}</h1>
      <p className="mt-2 text-sm text-zinc-600">Note content placeholder.</p>
    </section>
  );
}
