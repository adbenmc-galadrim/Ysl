export type Truth = {
  carrier?: string;
  recipient: string | null;
  sender: string | null;
};

export type PhotoSource = {
  id: string;
  name: string;
  truth?: Truth;
  blob: () => Promise<Blob>;
};

export type PackItem = {
  id: string;
  file: string;
  carrier: string;
  recipient: string | null;
  sender: string | null;
  difficulties: string[];
};

export type PackManifest = {
  seed: number;
  items: PackItem[];
};
