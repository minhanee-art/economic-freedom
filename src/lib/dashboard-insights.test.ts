import test from "node:test";
import assert from "node:assert/strict";

import {
  computeDailyChange,
  computeDividendYields,
  heatmapTone,
  layoutHeatmap,
  groupSmallHoldings,
  heatmapAspect,
  heatmapLabelLevel,
  HEATMAP_OTHER_ID,
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

const hi = (id: string, value: number, returnPct = 5): HeatmapItem => ({ id, name: id, value, returnPct, hasCost: true });

test("히트맵 배치: 넘겨 준 비율대로 칸 모양이 달라진다(넓은 화면은 납작해지지 않는다)", () => {
  const items = [hi("a", 50), hi("b", 30), hi("c", 20)];
  // 화면 비율 4.6 에 실제로 그렸을 때 가장 납작한 칸의 가로세로 비
  const worstRatio = (layoutAspect: number) =>
    Math.max(
      ...layoutHeatmap(items, layoutAspect).map((r) => {
        const ratio = ((r.w / 100) * 4.6) / (r.h / 100);
        return Math.max(ratio, 1 / ratio);
      })
    );
  assert.ok(worstRatio(4.6) < worstRatio(1.6), "실제 비율로 배치하면 1.6 으로 늘린 것보다 덜 납작하다");
  const wide = layoutHeatmap(items, 4.6);
  const area = wide.reduce((s, r) => s + (r.w * r.h) / 10_000, 0);
  assert.ok(Math.abs(area - 1) < 1e-6);
  // 가로로 긴 영역이면 큰 칸이 전체 높이를 쓰고 옆으로 이어진다
  assert.equal(wide[0].h, 100);
});

test("히트맵 비율: 실제 px 에서 구하고, 측정 전·잘못된 값은 폰 기본 비율", () => {
  assert.ok(Math.abs(heatmapAspect(1030, 224) - 4.598) < 0.01);
  assert.equal(heatmapAspect(318, 192), 318 / 192);
  assert.equal(heatmapAspect(0, 0), 1.6);
  assert.equal(heatmapAspect(100, 0), 1.6);
  assert.equal(heatmapAspect(Number.NaN, 100), 1.6);
});

test("기타 묶음: 2% 미만 종목 2개 이상이면 한 칸으로 묶고 면적은 합, 색은 중립", () => {
  const items = [hi("a", 60), hi("b", 30), hi("c", 6), hi("d", 1.5, -40), hi("e", 1.5, 40), hi("f", 1)];
  const { tiles, grouped } = groupSmallHoldings(items);
  assert.deepEqual(grouped.map((g) => g.id), ["d", "e", "f"]);
  const other = tiles.find((t) => t.id === HEATMAP_OTHER_ID);
  assert.ok(other);
  assert.equal(other.name, "기타 3종목");
  assert.equal(other.groupedCount, 3);
  assert.equal(other.value, 4);
  assert.equal(heatmapTone(other.returnPct, other.hasCost), "flat");
  assert.deepEqual(tiles.map((t) => t.id), ["a", "b", "c", HEATMAP_OTHER_ID]);
});

test("기타 묶음 경계: 정확히 2% 는 묶지 않고, 2% 바로 아래는 묶는다", () => {
  const exact = groupSmallHoldings([hi("a", 60), hi("b", 20), hi("c", 18), hi("d", 2)]);
  assert.equal(exact.grouped.length, 0);
  assert.equal(exact.tiles.length, 4);
  const below = groupSmallHoldings([hi("a", 60), hi("b", 20), hi("c", 18.1), hi("d", 1.9)]);
  // 2% 미만이 1개뿐이라 묶지 않는다
  assert.equal(below.grouped.length, 0);
  const two = groupSmallHoldings([hi("a", 60), hi("b", 20), hi("c", 18.2), hi("d", 1.0), hi("e", 0.8)]);
  assert.equal(two.grouped.length, 2);
});

test("기타 묶음: 묶을 종목이 1개뿐이면 묶지 않는다", () => {
  const { tiles, grouped } = groupSmallHoldings([hi("a", 70), hi("b", 20), hi("c", 9), hi("d", 1)]);
  assert.equal(grouped.length, 0);
  assert.equal(tiles.length, 4);
  assert.ok(tiles.every((t) => t.id !== HEATMAP_OTHER_ID));
});

test("기타 묶음: 거의 전부 2% 미만이라 묶으면 3칸이 안 되면 묶지 않는다", () => {
  const many = Array.from({ length: 60 }, (_, i) => hi(`s${i}`, 1));
  const r = groupSmallHoldings(many);
  assert.equal(r.grouped.length, 0);
  assert.equal(r.tiles.length, 60);
  // 큰 종목 1개 + 작은 종목들 → 기타 포함 2칸뿐
  const r2 = groupSmallHoldings([hi("a", 90), hi("b", 1), hi("c", 1)]);
  assert.equal(r2.grouped.length, 0);
});

test("기타 묶음: 빈 입력·0 값", () => {
  assert.deepEqual(groupSmallHoldings([]), { tiles: [], grouped: [] });
  assert.deepEqual(groupSmallHoldings([hi("z", 0)]), { tiles: [], grouped: [] });
});

test("히트맵 글자 단계: 칸 px 크기로 두 줄·한 줄·없음을 정한다", () => {
  assert.equal(heatmapLabelLevel(130, 100), "two-line");
  assert.equal(heatmapLabelLevel(72, 40), "two-line");
  assert.equal(heatmapLabelLevel(71, 40), "one-line");
  assert.equal(heatmapLabelLevel(72, 39), "one-line");
  assert.equal(heatmapLabelLevel(68, 24), "one-line");
  assert.equal(heatmapLabelLevel(67, 100), "none");
  assert.equal(heatmapLabelLevel(300, 23), "none");
  assert.equal(heatmapLabelLevel(0, 0), "none");
});
