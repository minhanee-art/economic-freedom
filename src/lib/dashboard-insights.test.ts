import test from "node:test";
import assert from "node:assert/strict";

import {
  computeDailyChange,
  computeDividendYields,
  heatmapTone,
  layoutHeatmap,
  type HeatmapItem,
} from "@/lib/dashboard-insights";

const NOW = new Date("2026-06-15T03:00:00Z"); // KST 2026-06-15

test("배당률: 12개월 이상 기록이면 최근 12개월 합계만 쓴다", () => {
  const y = computeDividendYields(
    [
      { date: "2024-01-10", amount: 999_999 }, // 12개월 밖
      { date: "2025-06-15", amount: 5_000 }, // 경계(제외)
      { date: "2025-06-16", amount: 10_000 },
      { date: "2026-03-01", amount: "20000" },
    ],
    1_000_000,
    1_500_000,
    NOW
  );
  assert.equal(y.trailing12mTotal, 30_000);
  assert.equal(y.costYieldPct, 3);
  assert.equal(y.marketYieldPct, 2);
  assert.equal(y.isPartialYear, false);
  assert.equal(y.coveredMonths, 12);
});

test("배당률: 기록이 12개월 미만이면 부분 기간 표시", () => {
  const y = computeDividendYields([{ date: "2026-02-20", amount: 10_000 }], 1_000_000, 1_000_000, NOW);
  assert.equal(y.isPartialYear, true);
  assert.equal(y.coveredMonths, 3);
  assert.equal(y.costYieldPct, 1);
});

test("배당률: 분모가 0이면 null, 기록이 없으면 hasRecords=false", () => {
  const y = computeDividendYields([{ date: "2026-02-20", amount: 10_000 }], 0, 0, NOW);
  assert.equal(y.costYieldPct, null);
  assert.equal(y.marketYieldPct, null);
  const none = computeDividendYields([], 1_000_000, 1_000_000, NOW);
  assert.equal(none.hasRecords, false);
  assert.equal(none.trailing12mTotal, 0);
});

test("일간 변동: 전일 스냅샷 대비 금액과 비율", () => {
  const c = computeDailyChange(
    { snapshotDate: "2026-06-14", valueChange: 10_000, netContribution: 0 },
    110_000
  );
  assert.ok(c);
  assert.equal(c.amount, 10_000);
  assert.equal(Math.round((c.pct ?? 0) * 100) / 100, 10);
  assert.equal(c.includesContribution, false);
});

test("일간 변동: 원가 변동이 있으면 표시, 스냅샷이 없으면 null", () => {
  const c = computeDailyChange({ snapshotDate: "2026-06-14", valueChange: 50, netContribution: 100 }, 150);
  assert.equal(c?.includesContribution, true);
  assert.equal(computeDailyChange({ snapshotDate: null, valueChange: null, netContribution: null }, 100), null);
  assert.equal(computeDailyChange(null, 100), null);
});

test("히트맵 배치: 면적 합이 100%이고 비중에 비례하며 겹치지 않는다", () => {
  const items: HeatmapItem[] = [
    { id: "a", name: "A", value: 500, returnPct: 5, hasCost: true },
    { id: "b", name: "B", value: 300, returnPct: -3, hasCost: true },
    { id: "c", name: "C", value: 150, returnPct: 0, hasCost: true },
    { id: "d", name: "D", value: 50, returnPct: 12, hasCost: true },
  ];
  const aspect = 1.6;
  const rects = layoutHeatmap(items, aspect);
  assert.equal(rects.length, 4);
  let area = 0;
  for (const r of rects) {
    assert.ok(r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= 100 + 1e-6 && r.y + r.h <= 100 + 1e-6);
    const share = (r.w * r.h) / 10_000;
    assert.ok(Math.abs(share * 100 - r.sharePct) < 1e-6, `${r.id} 면적 비례`);
    area += share;
  }
  assert.ok(Math.abs(area - 1) < 1e-6);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
      assert.equal(overlap, false, `${a.id}/${b.id} 겹침`);
    }
  }
});

test("히트맵 배치: 빈 입력·0 값은 빈 배열", () => {
  assert.deepEqual(layoutHeatmap([]), []);
  assert.deepEqual(layoutHeatmap([{ id: "x", name: "X", value: 0, returnPct: 0, hasCost: true }]), []);
});

test("히트맵 색 구간", () => {
  assert.equal(heatmapTone(12), "gain-strong");
  assert.equal(heatmapTone(3), "gain");
  assert.equal(heatmapTone(0.2), "flat");
  assert.equal(heatmapTone(-4), "loss");
  assert.equal(heatmapTone(-15), "loss-strong");
  assert.equal(heatmapTone(20, false), "flat");
});
