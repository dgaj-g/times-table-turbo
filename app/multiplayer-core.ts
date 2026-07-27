export type PlayerName = "Jarlath" | "Anya";
export type MultiplayerMode = "race" | "coop";
export type RoomStatus = "waiting" | "playing" | "finished";
export type Question = { a: number; b: number };
export type MistakeRecord = Question & { count: number };

export type PlayerState = {
  uid: string;
  online: boolean;
  score: number;
  correct: number;
  combo: number;
  questionIndex: number;
  joinedAt: number;
  mistakes?: Record<string, MistakeRecord>;
};

export type CoopState = {
  score: number;
  correct: number;
  attempts: number;
  combo: number;
  lives: number;
  questionIndex: number;
  currentTurn: PlayerName;
  mistakes?: Record<string, MistakeRecord>;
};

export type RoomState = {
  mode: MultiplayerMode;
  status: RoomStatus;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  tables: number[];
  seed: number;
  startedAt: number | null;
  players: Partial<Record<PlayerName, PlayerState>>;
  coop?: CoopState;
};

export const PLAYERS: PlayerName[] = ["Jarlath", "Anya"];
export const MULTIPLAYER_SECONDS = 60;
export const ROOM_LIFETIME_MS = 2 * 60 * 60 * 1000;

function mixed(seed: number, index: number, salt: number) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function multiplayerQuestion(
  seed: number,
  index: number,
  tables: number[],
): Question {
  const safeTables = tables.length ? tables : [1];
  const table = safeTables[mixed(seed, index, 17) % safeTables.length];
  const multiplier = (mixed(seed, index, 41) % 12) + 1;
  return mixed(seed, index, 73) % 2
    ? { a: table, b: multiplier }
    : { a: multiplier, b: table };
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
}

export function otherPlayer(player: PlayerName): PlayerName {
  return player === "Jarlath" ? "Anya" : "Jarlath";
}
