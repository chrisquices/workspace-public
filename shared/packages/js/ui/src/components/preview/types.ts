import type { MaybeRefOrGetter } from 'vue';

export interface PreviewFile {
  uid: string;
  name: string;
  src: string | Blob;
  type?: 'image' | 'video' | 'audio' | 'file';
  thumbnailUrl?: string | null;
}

export interface PreviewProps<TFile extends PreviewFile = PreviewFile> {
  files: readonly TFile[];
}

export type PreviewSource = MaybeRefOrGetter<readonly PreviewFile[]>;

export interface PreviewContext {
  readonly isOpen: boolean;
  readonly files: readonly PreviewFile[];
  readonly currentUid: string | null;
  readonly index: number;
  open: (source: PreviewSource, uid: string) => void;
  close: () => void;
}
