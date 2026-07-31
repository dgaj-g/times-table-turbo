import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuestionSequence,
  questionAt,
  type Question,
} from "../app/question-sequence.ts";

function key({ a, b }: Question) {
  return [a, b].sort((left, right) => left - right).join("x");
}

test("single-table practice asks every fact before repeating", () => {
  const sequence = createQuestionSequence([7], 12345);
  const firstPass = sequence.firstPass.map((_, index) => questionAt(sequence, index));

  assert.equal(firstPass.length, 12);
  assert.equal(new Set(firstPass.map(key)).size, 12);
  assert.equal(firstPass.filter(({ a, b }) => a === 1 || b === 1).length, 1);
});

test("times-one facts are not repeated later in a run", () => {
  const sequence = createQuestionSequence([3, 7], 67890);
  const questions = Array.from({ length: 100 }, (_, index) =>
    questionAt(sequence, index),
  );
  const timesOneKeys = questions
    .filter(({ a, b }) => a === 1 || b === 1)
    .map(key);

  assert.equal(timesOneKeys.length, 2);
  assert.equal(new Set(timesOneKeys).size, 2);
  assert.ok(
    questions
      .slice(sequence.firstPass.length)
      .every(({ a, b }) => a !== 1 && b !== 1),
  );
});

test("commuted questions count as the same fact", () => {
  const sequence = createQuestionSequence([3, 7], 24680);
  const firstPass = sequence.firstPass.map((_, index) => questionAt(sequence, index));

  assert.equal(firstPass.length, 23);
  assert.equal(new Set(firstPass.map(key)).size, 23);
});

test("a seeded sequence is deterministic", () => {
  const sequence = createQuestionSequence([8], 13579);
  const firstRun = Array.from({ length: 36 }, (_, index) =>
    questionAt(sequence, index),
  );
  const repeatedSequence = createQuestionSequence([8], 13579);
  const secondRun = Array.from({ length: 36 }, (_, index) =>
    questionAt(repeatedSequence, index),
  );

  assert.deepEqual(firstRun, secondRun);
  assert.equal(new Set(firstRun.slice(0, 12).map(key)).size, 12);
  assert.equal(
    firstRun.filter(({ a, b }) => a === 1 || b === 1).length,
    1,
  );
});
