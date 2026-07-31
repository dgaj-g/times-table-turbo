import assert from "node:assert/strict";
import test from "node:test";
import {
  createFactFamilyRound,
  divisionChoices,
  divisionConnection,
} from "../app/fact-family-core.ts";

test("creates five unique non-square families from the selected tables", () => {
  const families = createFactFamilyRound([6, 7], 5, () => 0.37);
  const keys = families.map(({ a, b }) => `${a}x${b}`);

  assert.equal(families.length, 5);
  assert.equal(new Set(keys).size, 5);
  assert.ok(families.every(({ a, b, product }) => a !== b && a * b === product));
  assert.ok(families.every(({ a, b }) => [a, b].some((value) => value === 6 || value === 7)));
});

test("both division connections reverse the multiplication fact", () => {
  const family = { a: 2, b: 6, product: 12 };

  assert.deepEqual(divisionConnection(family, 0), {
    dividend: 12,
    divisor: 6,
    answer: 2,
  });
  assert.deepEqual(divisionConnection(family, 1), {
    dividend: 12,
    divisor: 2,
    answer: 6,
  });
});

test("answer choices are unique and always include the connection answer", () => {
  const family = { a: 4, b: 9, product: 36 };
  const choices = divisionChoices(family, 1, () => 0.42);

  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.includes(9));
});
