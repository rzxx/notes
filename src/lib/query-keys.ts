export const queryKeys = {
  notes: {
    list: (parentId: string | null) => ["notes", parentId] as const,
    detail: (id: string | null) => ["note", id] as const,
  },
};
