import assert from "node:assert/strict";
import test from "node:test";
import { pointerEndedInsideKey } from "../app/keypad-core.ts";

const bounds = { left: 100, right: 200, top: 300, bottom: 400 };

test("a touch released inside its original key is accepted", () => {
  assert.equal(pointerEndedInsideKey(bounds, 150, 350), true);
  assert.equal(pointerEndedInsideKey(bounds, 100, 300), true);
  assert.equal(pointerEndedInsideKey(bounds, 200, 400), true);
});

test("a touch released over a neighbouring key is rejected", () => {
  assert.equal(pointerEndedInsideKey(bounds, 201, 350), false);
  assert.equal(pointerEndedInsideKey(bounds, 99, 350), false);
  assert.equal(pointerEndedInsideKey(bounds, 150, 401), false);
  assert.equal(pointerEndedInsideKey(bounds, 150, 299), false);
});
