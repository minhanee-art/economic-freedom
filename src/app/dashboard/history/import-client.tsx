"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatFullKRW } from "@/lib/utils";
import type { Holding } from "@/types";

interface ParsedRow {
  date: string;         // YYYY-MM-DD
  code: string;         // 종목코드 6자리
  name: string;         // 종목명
  type: string;         // 매수/매도
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  tax: number;
}

interface Props {
  holdings: Holding[];
  userId: string;
  onClose: () => void;
}

export function ImportClient({ holdings, userId, onClose }: Props) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const holdingMap = new Map(holdings.map((h) => [h.code, h]));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        // HTML(xls) 파일인지 CSV인지 판별
        const rows = text.trimStart().startsWith("<")
          ? parseHTMLTable(text)
          : parseCSV(text);
        if (rows.length === 0) {
          setError("매수 내역을 찾을 수 없습니다. 파일 형식을 확인해주세요.");
          return;
        }
        setParsedRows(rows);
      } catch (err) {
        setError(`파일 파싱 실패: ${(err as Error).message}`);
      }
    };
    // xls(HTML) 또는 CSV 판별
    const isXLS =
      file.name.endsWith(".xls") || file.name.endsWith(".xlsx");
    reader.readAsText(file, isXLS ? "UTF-8" : "EUC-KR");
  };

  const buyRows = parsedRows.filter((r) => r.type === "매수");

  const handleImport = async () => {
    if (buyRows.length === 0) return;
    setIsImporting(true);

    try {
      const items = buyRows.map((row) => ({
        date: row.date,
        code: row.code,
        name: row.name,
        qty: row.quantity,
        price: row.price,
        amount: row.amount,
      }));

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let msg = `${data.totalRecords}건의 매수 기록, ${data.totalItems}개 종목 데이터가 반영되었습니다.`;
      if (data.skipped?.length > 0) {
        msg += ` (미등록 종목 건너뜀: ${data.skipped.join(", ")})`;
      }
      setResult(msg);
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 2000);
    } catch (err) {
      setError(`가져오기 실패: ${(err as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">거래내역 가져오기</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 안내 */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm space-y-2">
          <p className="font-medium">미래에셋증권 거래내역 다운로드 방법:</p>
          <ol className="list-decimal list-inside text-zinc-500 space-y-1 text-xs">
            <li>m.stock 앱 → 메뉴 → 자산/내역 → 거래내역</li>
            <li>기간 설정 후 조회 → 다운로드(엑셀/CSV)</li>
            <li>또는 HTS(카이로스) → [0650] 거래내역 → 엑셀 저장</li>
          </ol>
          <p className="text-xs text-zinc-400">
            CSV 컬럼: 거래일자, 종목코드, 종목명, 매수/매도, 수량, 단가, 거래금액, 수수료, 세금
          </p>
        </div>

        {/* 직접 CSV 형식 안내 */}
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-3 text-xs text-zinc-500 space-y-1">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">
            직접 CSV 만들기 (엑셀에서 저장):
          </p>
          <pre className="bg-zinc-100 dark:bg-zinc-800 rounded p-2 overflow-x-auto">
{`거래일자,종목코드,종목명,구분,수량,단가,거래금액,수수료,세금
2025-03-15,305050,ACE 코스피,매수,3,55000,165000,0,0
2025-03-15,354500,ACE 코스닥150,매수,5,17500,87500,0,0`}
          </pre>
        </div>

        {/* 파일 선택 */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-11 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-500 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
          >
            CSV 파일 선택
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            {result}
          </div>
        )}

        {/* 파싱 결과 미리보기 */}
        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {parsedRows.length}건 파싱됨 (매수 {buyRows.length}건)
            </p>

            {/* 미등록 종목 경고 */}
            {buyRows.some((r) => !holdingMap.has(r.code)) && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                일부 종목이 설정에 등록되지 않아 건너뜁니다:{" "}
                {buyRows
                  .filter((r) => !holdingMap.has(r.code))
                  .map((r) => `${r.name}(${r.code})`)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(", ")}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">날짜</th>
                    <th className="px-2 py-1.5 text-left">종목</th>
                    <th className="px-2 py-1.5 text-left">구분</th>
                    <th className="px-2 py-1.5 text-right">수량</th>
                    <th className="px-2 py-1.5 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {parsedRows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.type !== "매수" ? "opacity-40" : ""
                      }
                    >
                      <td className="px-2 py-1.5">{row.date}</td>
                      <td className="px-2 py-1.5 truncate max-w-[120px]">
                        {row.name}
                      </td>
                      <td className="px-2 py-1.5">{row.type}</td>
                      <td className="px-2 py-1.5 text-right">{row.quantity}</td>
                      <td className="px-2 py-1.5 text-right">
                        {formatFullKRW(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting || buyRows.length === 0}
              className="w-full h-11 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {isImporting
                ? "가져오는 중..."
                : `매수 ${buyRows.length}건 가져오기`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** CSV 파싱 — 미래에셋 및 일반 CSV 형식 지원 */
function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // 헤더 행 찾기 (거래일자 또는 날짜가 포함된 행)
  let headerIdx = lines.findIndex(
    (l) =>
      l.includes("거래일자") ||
      l.includes("일자") ||
      l.includes("날짜") ||
      l.includes("date")
  );
  if (headerIdx === -1) headerIdx = 0;

  const header = lines[headerIdx].split(",").map((h) => h.replace(/"/g, "").trim());

  // 컬럼 인덱스 찾기
  const dateIdx = header.findIndex((h) =>
    /거래일자|일자|날짜|date/i.test(h)
  );
  const codeIdx = header.findIndex((h) =>
    /종목코드|종목번호|코드|code/i.test(h)
  );
  const nameIdx = header.findIndex((h) =>
    /종목명|종목|name/i.test(h)
  );
  const typeIdx = header.findIndex((h) =>
    /구분|매매구분|거래구분|매수매도|type/i.test(h)
  );
  const qtyIdx = header.findIndex((h) =>
    /수량|체결수량|quantity|qty/i.test(h)
  );
  const priceIdx = header.findIndex((h) =>
    /단가|체결단가|체결가|price/i.test(h)
  );
  const amountIdx = header.findIndex((h) =>
    /거래금액|결제금액|금액|amount/i.test(h)
  );
  const feeIdx = header.findIndex((h) => /수수료|fee/i.test(h));
  const taxIdx = header.findIndex((h) => /세금|tax/i.test(h));

  if (dateIdx === -1 || qtyIdx === -1) {
    throw new Error(
      "필수 컬럼(거래일자, 수량)을 찾을 수 없습니다."
    );
  }

  const rows: ParsedRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    if (cols.length < 3) continue;

    const rawDate = cols[dateIdx] ?? "";
    const date = normalizeDate(rawDate);
    if (!date) continue;

    const quantity = parseNum(cols[qtyIdx]);
    if (quantity <= 0) continue;

    const price = priceIdx !== -1 ? parseNum(cols[priceIdx]) : 0;
    const amount =
      amountIdx !== -1 ? parseNum(cols[amountIdx]) : price * quantity;
    const code = codeIdx !== -1 ? cols[codeIdx].replace(/[^0-9A-Za-z]/g, "") : "";
    const name = nameIdx !== -1 ? cols[nameIdx] : "";
    const type = typeIdx !== -1 ? normalizeType(cols[typeIdx]) : "매수";
    const fee = feeIdx !== -1 ? parseNum(cols[feeIdx]) : 0;
    const tax = taxIdx !== -1 ? parseNum(cols[taxIdx]) : 0;

    rows.push({ date, code, name, type, quantity, price, amount, fee, tax });
  }

  return rows;
}

function normalizeDate(raw: string): string {
  // YYYYMMDD → YYYY-MM-DD
  const d1 = raw.replace(/[./\-\s]/g, "");
  if (/^\d{8}$/.test(d1)) {
    return `${d1.slice(0, 4)}-${d1.slice(4, 6)}-${d1.slice(6, 8)}`;
  }
  // YYYY-MM-DD 이미 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // YYYY.MM.DD or YYYY/MM/DD
  const m = raw.match(/(\d{4})[./](\d{2})[./](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

function normalizeType(raw: string): string {
  if (/매수|buy|B/i.test(raw)) return "매수";
  if (/매도|sell|S/i.test(raw)) return "매도";
  return raw;
}

function parseNum(raw: string): number {
  return parseInt(raw.replace(/[^0-9.-]/g, "")) || 0;
}

/** 미래에셋 xls (HTML 테이블) 파싱 */
function parseHTMLTable(html: string): ParsedRow[] {
  // DOM Parser로 테이블 셀 추출
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = doc.querySelectorAll("table");

  // 거래내역 테이블 찾기 (id="detailTable" 또는 가장 큰 테이블)
  let targetTable: Element | null =
    doc.getElementById("detailTable");
  if (!targetTable) {
    let maxRows = 0;
    tables.forEach((t) => {
      const rowCount = t.querySelectorAll("tr").length;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        targetTable = t;
      }
    });
  }
  if (!targetTable) return [];

  const trs = targetTable.querySelectorAll("tr");
  const rawRows: string[][] = [];
  trs.forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("td, th").forEach((td) => {
      cells.push((td.textContent ?? "").trim());
    });
    if (cells.length > 0) rawRows.push(cells);
  });

  // 미래에셋 형식: 2행이 1거래 (헤더 2행 + 데이터 2행씩)
  // 행1: 거래일자, 거래종류, 거래수량, 거래금액, 예수금잔고, 수수료, 미수총잔고
  // 행2: 종목명, 단가, 입출금액, 유가잔고, 제세금합, 미수발생/변제금

  // 헤더 행 찾기
  let dataStart = 0;
  for (let i = 0; i < rawRows.length; i++) {
    if (rawRows[i].some((c) => c.includes("거래일자"))) {
      dataStart = i + 2; // 헤더 2행 건너뛰기
      break;
    }
  }

  // 종목명 → 종목코드 매핑 (미래에셋 xls는 종목코드가 없음)
  const NAME_CODE_MAP: Record<string, string> = {
    "TIGER200": "102110",
    "TIGER골드선물": "319640",
    "TIGER나스닥100": "133690",
    "TIGER미국채10년선물": "305080",
    "TIGERMSCI": "182480",
    "TIGER미국MSCI리츠": "182480",
    "KODEXMSCI": "251350",
    "KODEXWTI": "261220",
    "KINDEX": "354350",
    "ARIRANG": "195980",
    "ACE코스피": "305050",
    "ACE코스닥": "354500",
    "PLUS고배당": "161510",
    "TIGER미국배당": "458730",
    "KODEX인도": "453810",
    "TIGER필라델피아": "497570",
    "ACE싱가포르": "316300",
    "KODEX코스피100": "237350",
    "ACE테슬라": "457480",
    "KODEX은선물": "144600",
    "KODEX단기채권": "153130",
    "TIGER반도체": "396500",
    "KODEX200": "069500",
    "KODEX레버리지": "122630",
    "KODEX인버스": "114800",
  };

  function matchCode(name: string): string {
    const n = name.replace(/\s/g, "");
    for (const [key, code] of Object.entries(NAME_CODE_MAP)) {
      if (n.includes(key)) return code;
    }
    return "";
  }

  const rows: ParsedRow[] = [];

  for (let i = dataStart; i < rawRows.length - 1; i += 2) {
    const r1 = rawRows[i];
    const r2 = rawRows[i + 1];
    if (!r1 || r1.length < 4) continue;

    const dateRaw = r1[0];
    const tradeType = r1[1] ?? "";
    const quantity = parseNum(r1[2]);
    const amount = parseNum(r1[3]);
    const fee = parseNum(r1[5] ?? "0");

    const name = r2?.[0] ?? "";
    const price = parseNum(r2?.[1] ?? "0");

    const date = normalizeDate(dateRaw);
    if (!date || quantity <= 0) continue;

    const type = normalizeType(tradeType);
    const code = matchCode(name);

    rows.push({
      date,
      code,
      name: name.length > 30 ? name.slice(0, 30) + "…" : name,
      type,
      quantity,
      price,
      amount,
      fee,
      tax: 0,
    });
  }

  return rows;
}
