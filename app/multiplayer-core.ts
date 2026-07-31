import { createQuestionSequence, questionAt } from "./question-sequence";
import type { Question } from "./question-sequence";

export type PlayerName = "Jarlath" | "Anya";
export type MultiplayerMode = "race" | "coop";
export type RoomStatus = "waiting" | "playing" | "finished";
export type { Question } from "./question-sequence";
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

export function multiplayerQuestion(
  seed: number,
  index: number,
  tables: number[],
): Question {
  return questionAt(createQuestionSequence(tables, seed), index);
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
