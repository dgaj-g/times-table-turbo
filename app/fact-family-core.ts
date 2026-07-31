export type FactFamily = {
  a: number;
  b: number;
  product: number;
};

export type DivisionConnection = {
  dividend: number;
  divisor: number;
  answer: number;
};

function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

export function createFactFamilyRound(
  tables: number[],
  count = 5,
  random: () => number = Math.random,
): FactFamily[] {
  const safeTables = Array.from(
    new Set(
      tables.filter(
        (table) => Number.isInteger(table) && table >= 2 && table <= 12,
      ),
    ),
  );
  if (!safeTables.length) {
    safeTables.push(...Array.from({ length: 11 }, (_, index) => index + 2));
  }

  const families = new Map<string, FactFamily>();
  for (const table of safeTables) {
    for (let partner = 2; partner <= 12; partner += 1) {
      if (partner === table) continue;
      const a = Math.min(table, partner);
      const b = Math.max(table, partner);
      families.set(`${a}x${b}`, { a, b, product: a * b });
    }
  }

  return shuffle(Array.from(families.values()), random).slice(0, count);
}

export function divisionConnection(
  family: FactFamily,
  step: 0 | 1,
): DivisionConnection {
  return step === 0
    ? { dividend: family.product, divisor: family.b, answer: family.a }
    : { dividend: family.product, divisor: family.a, answer: family.b };
}

export function divisionChoices(
  family: FactFamily,
  step: 0 | 1,
  random: () => number = Math.random,
) {
  const correct = divisionConnection(family, step).answer;
  const alternatives = shuffle(
    Array.from({ length: 11 }, (_, index) => index + 2).filter(
      (choice) => choice !== correct,
    ),
    random,
  ).slice(0, 3);

  return shuffle([correct, ...alternatives], random);
}
