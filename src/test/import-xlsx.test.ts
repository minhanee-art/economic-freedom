import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  parseTradingRows,
  parseXLSX,
  type CellValue,
} from "@/app/dashboard/history/import-client";

const header = ["거래일자", "거래구분", "펀드명", "수량", "거래금액", "잔고", "수수료"];

function sheet(rows: CellValue[][]): CellValue[][] {
  return [["미래에셋증권 거래내역"], header, ...rows];
}

test("parseTradingRows: 헤더 앞의 제목 행을 건너뛰고 거래 내역만 뽑는다", () => {
  const rows = parseTradingRows(
    sheet([["2026-01-05", "매수", "TIGER 미국배당", 10, 100_000, 0, 1_500]])
  );

  assert.deepEqual(rows, [
    {
      date: "2026-01-05",
      code: "458730",
      name: "TIGER 미국배당",
      type: "매수",
      quantity: 10,
      price: 10_000,
      amount: 100_000,
      fee: 1_500,
      tax: 0,
    },
  ]);
});

test("parseTradingRows: 매수·매도·분배금을 구분하고 관심 없는 종류는 버린다", () => {
  const rows = parseTradingRows(
    sheet([
      ["2026-01-05", "매수", "TIGER 미국배당", 10, 100_000, 0, 1_500],
      ["2026-02-01", "매도", "TIGER 미국배당", 5, 60_000, 0, 900],
      ["2026-02-10", "분배금", "TIGER 미국배당", 0, 1_200, 0, 0],
      ["2026-02-11", "배당금", "TIGER 미국배당", 0, 800, 0, 0],
      ["2026-02-12", "입금", "-", 0, 500_000, 0, 0],
      ["2026-02-13", "출금", "-", 0, 100_000, 0, 0],
    ])
  );

  assert.deepEqual(
    rows.map((row) => [row.type, row.quantity, row.amount, row.price]),
    [
      ["매수", 10, 100_000, 10_000],
      ["매도", 5, 60_000, 12_000],
      ["배당", 0, 1_200, 0],
      ["배당", 0, 800, 0],
    ]
  );
});

test("parseTradingRows: 수량 0 매수·0원 거래·날짜 없는 행은 버린다", () => {
  const rows = parseTradingRows(
    sheet([
      ["2026-01-05", "매수", "TIGER 미국배당", 0, 100_000, 0, 0],
      ["2026-01-06", "매수", "TIGER 미국배당", 10, 0, 0, 0],
      ["", "매수", "TIGER 미국배당", 10, 100_000, 0, 0],
      ["2026-01-07", "매수", "TIGER 미국배당", 10, 100_000, 0, 0],
    ])
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-01-07");
});

test("parseTradingRows: 날짜 셀이 Date 객체여도 YYYY-MM-DD로 만든다", () => {
  const rows = parseTradingRows([
    header,
    [new Date(2026, 0, 9), "매수", "KODEX 200", 2, 20_000, 0, 0],
  ]);

  assert.equal(rows[0].date, "2026-01-09");
  assert.equal(rows[0].code, "069500");
});

test("parseTradingRows: 종목명이 30자를 넘으면 줄이고, 코드를 못 찾으면 빈 값으로 둔다", () => {
  const longName = "TIGER 미국S&P500 미국채혼합형 장기투자형 상장지수펀드";
  const rows = parseTradingRows(
    sheet([
      [new Date(2026, 2, 4), "매수", longName, 3, 30_003, 0, 0],
      ["2026-03-05", "매수", "알 수 없는 펀드", 1, 1_000, 0, 0],
    ])
  );

  assert.equal(rows[0].name, `${longName.slice(0, 30)}…`);
  assert.equal(rows[0].name.length, 31);
  assert.equal(rows[0].code, "360750");
  assert.equal(rows[0].price, 10_001);
  assert.equal(rows[1].code, "");
});

test("parseTradingRows: 빈 행은 건너뛰고, 헤더가 없으면 오류를 던진다", () => {
  const rows = parseTradingRows(
    sheet([
      [null, null, null, null, null, null, null],
      ["2026-01-05", "매수", "TIGER 미국배당", 10, 100_000, 0, 0],
    ])
  );
  assert.equal(rows.length, 1);

  assert.throws(
    () => parseTradingRows([["제목"], ["날짜", "구분"]]),
    /헤더를 찾을 수 없습니다/
  );
});

test("parseXLSX: 실제 xlsx 파일을 읽어 거래 내역을 만든다", async () => {
  const path = fileURLToPath(new URL("./fixtures/mirae-trades.xlsx", import.meta.url));
  const buffer = readFileSync(path);
  const rows = await parseXLSX(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  );

  assert.deepEqual(
    rows.map((row) => [row.date, row.type, row.code, row.quantity, row.price, row.fee]),
    [
      ["2026-01-05", "매수", "458730", 10, 10_000, 1_500],
      ["2026-02-01", "매도", "458730", 5, 12_000, 900],
      ["2026-02-10", "배당", "458730", 0, 0, 0],
      ["2026-03-04", "매수", "360750", 3, 10_001, 0],
    ]
  );
});

test("parseXLSX: xlsx가 아닌 바이트는 오류로 끝난다", async () => {
  const bogus = new TextEncoder().encode("not a spreadsheet").buffer;

  await assert.rejects(() => parseXLSX(bogus as ArrayBuffer));
});
