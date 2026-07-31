export type Question = { a: number; b: number };

type Fact = readonly [number, number];

export type QuestionSequence = {
  seed: number;
  firstPass: Fact[];
  repeatPass: Fact[];
};

function nextRandom(state: number) {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function shuffle<T>(items: T[], seed: number) {
  let state = seed || 0x9e3779b9;
  for (let index = items.length - 1; index > 0; index -= 1) {
    state = nextRandom(state);
    const swapIndex = state % (index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function canonicalFact(a: number, b: number): Fact {
  return a <= b ? [a, b] : [b, a];
}

function factKey([a, b]: Fact) {
  return `${a}x${b}`;
}

export function createQuestionSequence(
  tables: number[],
  seed: number,
): QuestionSequence {
  const safeTables = Array.from(
    new Set(tables.filter((table) => Number.isInteger(table) && table >= 1 && table <= 12)),
  );
  if (!safeTables.length) safeTables.push(1);

  const facts = new Map<string, Fact>();
  for (const table of safeTables) {
    for (let multiplier = 1; multiplier <= 12; multiplier += 1) {
      const fact = canonicalFact(table, multiplier);
      facts.set(factKey(fact), fact);
    }
  }

  const firstPass = shuffle(Array.from(facts.values()), seed);
  const usefulFacts = firstPass.filter(([a, b]) => a !== 1 && b !== 1);

  return {
    seed: seed >>> 0,
    firstPass,
    // Keep focus mode playable if the 1 table is selected on its own. In all
    // other runs, ×1 facts disappear after they have each appeared once.
    repeatPass: usefulFacts.length ? usefulFacts : firstPass,
  };
}

export function questionAt(
  sequence: QuestionSequence,
  index: number,
): Question {
  const safeIndex = Math.max(0, Math.floor(index));
  const fact =
    safeIndex < sequence.firstPass.length
      ? sequence.firstPass[safeIndex]
      : sequence.repeatPass[
          (safeIndex - sequence.firstPass.length) % sequence.repeatPass.length
        ];
  const [a, b] = fact;

  if (a === b) return { a, b };
  const orientation = nextRandom(sequence.seed ^ Math.imul(safeIndex + 1, 0x45d9f3b));
  return orientation % 2 ? { a, b } : { a: b, b: a };
}
