export type NoteDetail = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

import type { BlockContent, BlockType } from "@/lib/editor/block-content";

export type NoteBlock = {
  id: string;
  type: BlockType;
  position: number;
  contentJson: BlockContent;
  plainText: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteDetailResponse = {
  ok: true;
  note: NoteDetail;
  blocks: NoteBlock[];
};
