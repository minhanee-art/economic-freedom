import test from "node:test";
import assert from "node:assert/strict";

import { checkRecordDate, isUuid, todayKstDateKey, toPositiveInt } from "@/lib/record-validation";

test("todayKstDateKey: UTC 15시 이후는 KST 다음 날", () => {
  assert.equal(todayKstDateKey(new Date("2026-11-27T14:59:59Z")), "2026-11-27");
  assert.equal(todayKstDateKey(new Date("2026-11-27T15:00:00Z")), "2026-11-28");
});

test("checkRecordDate: 오늘(KST)까지 허용, 내일(KST)은 거부", () => {
  const now = new Date("2026-11-27T15:30:00Z"); // KST 2026-11-28 00:30
  assert.deepEqual(checkRecordDate("2026-11-28", now), { ok: true, date: "2026-11-28" });
  assert.equal(checkRecordDate("2026-11-29", now).ok, false);
});

test("checkRecordDate: 웹이 보내는 UTC 날짜(KST 새벽엔 어제)는 통과한다", () => {
  const now = new Date("2026-11-27T16:00:00Z"); // KST 2026-11-28 01:00, UTC 날짜는 11-27
  assert.equal(checkRecordDate(now.toISOString().split("T")[0], now).ok, true);
});

test("checkRecordDate: 형식·실존·하한 검사", () => {
  const now = new Date("2026-11-27T00:00:00Z");
  for (const value of ["2026-2-1", "2026/02/01", "2026-02-30", "2026-13-01", "1969-12-31", "", null, 20260101]) {
    assert.equal(checkRecordDate(value, now).ok, false, String(value));
  }
  assert.equal(checkRecordDate("2024-02-29", now).ok, true);
});

test("toPositiveInt: 1 이상 INT 범위 정수만", () => {
  assert.equal(toPositiveInt(1), 1);
  assert.equal(toPositiveInt("25"), 25);
  assert.equal(toPositiveInt(2_147_483_647), 2_147_483_647);
  for (const value of [0, -1, 1.5, "1.5", "", " ", "abc", 2_147_483_648, Infinity, NaN, null, undefined, true, [1]]) {
    assert.equal(toPositiveInt(value), null, String(value));
  }
});

test("isUuid", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isUuid("h1"), false);
  assert.equal(isUuid(undefined), false);
});
