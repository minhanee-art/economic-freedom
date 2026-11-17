import test from "node:test";
import assert from "node:assert/strict";

import { buildFallbackCandles } from "@/components/portfolio/rebalance-alert";

test("buildFallbackCandles: 12개 캔들을 만들고 양 끝에 매입가·현재가를 둔다", () => {
  const candles = buildFallbackCandles(9_000, 10_000, 10);

  assert.equal(candles.length, 12);
  assert.equal(candles[0].date, "매입");
  assert.equal(candles.at(-1)?.date, "현재");
  assert.equal(candles[0].close, 9_000);
  assert.equal(candles.at(-1)?.close, 10_000);
  assert.equal(candles[0].open, 9_000);
});

test("buildFallbackCandles: 고가는 몸통 위, 저가는 몸통 아래에 있고 1원 밑으로 내려가지 않는다", () => {
  const candles = buildFallbackCandles(9_000, 10_000, 10);

  for (const candle of candles) {
    const body = Math.max(candle.open, candle.close);
    const bodyLow = Math.min(candle.open, candle.close);
    assert.ok(candle.high >= body, `high ${candle.high} >= ${body}`);
    assert.ok(candle.low <= bodyLow, `low ${candle.low} <= ${bodyLow}`);
    assert.ok(candle.low >= 1);
  }
});

test("buildFallbackCandles: 거래량은 보유 수량에서 나온다", () => {
  const candles = buildFallbackCandles(9_000, 10_000, 10);
  const zeroShares = buildFallbackCandles(9_000, 10_000, 0);

  assert.deepEqual(
    candles.map((candle) => Number(candle.volume.toFixed(2))),
    [7.2, 14.2, 12.2, 10.2, 8.2, 15.2, 13.2, 11.2, 9.2, 7.2, 14.2, 12.2]
  );
  assert.deepEqual(zeroShares.map((candle) => candle.volume), Array(12).fill(0));
});

test("buildFallbackCandles: 변동이 0이면 양 끝만 고정하고 중간은 최소 변동성으로 흔든다", () => {
  const candles = buildFallbackCandles(10_000, 10_000, 5);

  assert.equal(candles[0].close, 10_000);
  assert.equal(candles.at(-1)?.close, 10_000);
  const inner = candles.slice(1, -1).map((candle) => candle.close);
  assert.ok(new Set(inner).size > 1, "중간 캔들은 서로 다른 종가를 가진다");
  for (const close of inner) {
    assert.ok(Math.abs(close - 10_000) / 10_000 <= 0.018 * 0.72 + 1e-9);
  }
});

test("buildFallbackCandles: 큰 변동에도 꼬리 폭은 변동성 상한(7%)을 넘지 않는다", () => {
  const candles = buildFallbackCandles(1_000, 2_000, 1);

  for (const candle of candles) {
    const body = Math.max(candle.open, candle.close);
    assert.ok(candle.high / body <= 1.045, `${candle.high} / ${body}`);
  }
});

test("buildFallbackCandles: 시작가나 종가가 0이면 남은 쪽 값을 쓴다", () => {
  const noStart = buildFallbackCandles(0, 5_000, 3);
  const noEnd = buildFallbackCandles(5_000, 0, 3);

  assert.equal(noStart[0].close, 5_000);
  assert.equal(noStart.at(-1)?.close, 5_000);
  assert.equal(noEnd[0].close, 5_000);
  assert.equal(noEnd.at(-1)?.close, 5_000);
});

test("buildFallbackCandles: 둘 다 0이면 1원 기준으로 만든다", () => {
  const candles = buildFallbackCandles(0, 0, 0);

  assert.equal(candles.length, 12);
  assert.equal(candles[0].close, 1);
  for (const candle of candles) {
    assert.ok(Number.isFinite(candle.high) && candle.high >= 1);
    assert.ok(Number.isFinite(candle.low) && candle.low >= 1);
  }
});
