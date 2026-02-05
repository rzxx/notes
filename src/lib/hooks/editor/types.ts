export type NoteDetail = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteBlock = {
  id: string;
  type: string;
  position: number;
  contentJson: unknown;
  plainText: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteDetailResponse = {
  ok: true;
  note: NoteDetail;
  blocks: NoteBlock[];
};
