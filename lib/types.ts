export interface User {
  id: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  rlName: string | null;
}

export interface ReplayRow {
  id: string;
  userId: string;
  sha256: string;
  playedAt: string | null;
  playlist: string;
  mapLabel: string;
  team0Score: number;
  team1Score: number;
  storageKey: string | null;
  storageStatus: string;
  byteLength: number;
  analysis: import("./replay/types").StoredReplay;
  createdAt: string;
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}
