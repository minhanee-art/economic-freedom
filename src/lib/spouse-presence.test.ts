import test from "node:test";
import assert from "node:assert/strict";
import { getSpousePresence } from "./spouse-presence";

const noGoal = { spouseBirthYear: null, spouseSalaryBracket: null };

test("배우자 데이터가 없으면 any=false", () => {
  const p = getSpousePresence({ goal: noGoal, accounts: [{ owner_type: "self" }, { owner_type: "child" }], sources: [{ member: "self" }] });
  assert.deepEqual(p, { goalFields: false, spouseAccountCount: 0, spouseSourceCount: 0, any: false });
});

test("배우자 출생연도·총급여 구간·명의 계좌·연금 소득원 중 하나만 있어도 any=true", () => {
  assert.equal(getSpousePresence({ goal: { ...noGoal, spouseBirthYear: 1982 }, accounts: [], sources: [] }).any, true);
  assert.equal(getSpousePresence({ goal: { ...noGoal, spouseSalaryBracket: "low" }, accounts: [], sources: [] }).any, true);
  const byAccount = getSpousePresence({ goal: noGoal, accounts: [{ owner_type: "spouse" }, { owner_type: "spouse" }], sources: [] });
  assert.equal(byAccount.any, true);
  assert.equal(byAccount.spouseAccountCount, 2);
  assert.equal(byAccount.goalFields, false);
  const bySource = getSpousePresence({ goal: noGoal, accounts: [], sources: [{ member: "spouse" }] });
  assert.equal(bySource.any, true);
  assert.equal(bySource.spouseSourceCount, 1);
});

test("알 수 없는 명의는 배우자로 보지 않는다", () => {
  assert.equal(getSpousePresence({ goal: noGoal, accounts: [{ owner_type: "SPOUSE" }, { owner_type: null }], sources: [] }).any, false);
});
