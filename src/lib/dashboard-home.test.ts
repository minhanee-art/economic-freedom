import test from "node:test";
import assert from "node:assert/strict";

import {
  homeCashflowStatus,
  homeTaxCreditStatus,
  upcomingDividendSchedule,
} from "@/lib/dashboard-home";

test("홈 상태: 세액공제 진행률과 남은 한도를 요약 응답에서 그대로 읽는다", () => {
  assert.deepEqual(
    homeTaxCreditStatus({ year: 2026, taxCredit: { progress: { progressPct: 40.4, remainingCreditRoom: 10_800_000 } } }),
    { kind: "ready", year: 2026, progressPct: 40, remaining: 10_800_000 }
  );
  assert.deepEqual(homeTaxCreditStatus({ year: 2026, taxCredit: null }), { kind: "unavailable", year: 2026 });
});

test("홈 상태: 은퇴 시점 예상 월 현금흐름 대 목표, 목표가 없으면 계산하지 않음", () => {
  assert.deepEqual(
    homeCashflowStatus({
      year: 2026,
      goal: { targetMonthly: 2_500_000 },
      retirement: { cashflow: { atRetirement: { age: 65, total: 2_781_000 }, coveragePctAtRetirement: 111.2 } },
    }),
    { kind: "ready", age: 65, monthly: 2_781_000, target: 2_500_000, coveragePct: 111 }
  );
  assert.deepEqual(
    homeCashflowStatus({ year: 2026, goal: { targetMonthly: null }, retirement: { cashflow: null } }),
    { kind: "unavailable" }
  );
});

test("홈 배당 일정: 사용자가 등록한 오늘 이후 일정만 가까운 순으로", () => {
  const items = [
    { id: "a", date: "2026-12-24", stock: "B", type: "분배금", note: "" },
    { id: "b", date: "2026-11-01", stock: "지난", type: "분배금", note: "" },
    { id: "c", date: "2026-12-06", stock: "A", type: "분배금", note: "" },
    { id: "d", date: "2027-01-10", stock: "C", type: "분배금", note: "" },
    { id: "e", date: "2027-02-10", stock: "D", type: "분배금", note: "" },
  ];
  assert.deepEqual(
    upcomingDividendSchedule(items, "2026-11-27").map((i) => i.id),
    ["c", "a", "d"]
  );
  assert.deepEqual(upcomingDividendSchedule([], "2026-11-27"), []);
});
