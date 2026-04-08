"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setError("매수 내역을 찾을 수 없습니다. 파일 형식을 확인해주세요.");
          return;
        }
        setParsedRows(rows);
      } catch (err) {
        setError(`파일 파싱 실패: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file, "EUC-KR"); // 한국 증권사 CSV는 대부분 EUC-KR
  };

  const buyRows = parsedRows.filter((r) => r.type === "매수");

  const handleImport = async () => {
    if (buyRows.length === 0) return;
    setIsImporting(true);

    try {
      const supabase = createClient();

      // 날짜별로 그룹핑
      const dateGroups = new Map<string, ParsedRow[]>();
      buyRows.forEach((row) => {
        const group = dateGroups.get(row.date) ?? [];
        group.push(row);
        dateGroups.set(row.date, group);
      });

      let totalRecords = 0;
      let totalItems = 0;

      for (const [date, rows] of dateGroups) {
        const totalSpent = rows.reduce((s, r) => s + r.amount, 0);

        // purchase_records 생성
        const { data: record, error: recErr } = await supabase
          .from("purchase_records")
          .insert({
            user_id: userId,
            date,
            total_spent: totalSpent,
            total_value_after: 0, // 과거 데이터라 정확한 값 없음
          })
          .select("id")
          .single();

        if (recErr) throw recErr;
        totalRecords++;

        // purchase_items 생성
        const items = rows.map((row) => {
          const holding = holdingMap.get(row.code);
          return {
            record_id: record.id,
            holding_id: holding?.id ?? null,
            code: row.code,
            name: row.name,
            quantity: row.quantity,
            price_at_purchase: row.price,
            cost: row.amount,
          };
        });

        // holding_id가 null인 항목은 제외 (등록되지 않은 종목)
        const validItems = items.filter((i) => i.holding_id !== null);
        if (validItems.length > 0) {
          const { error: itemErr } = await supabase
            .from("purchase_items")
            .insert(validItems);
          if (itemErr) throw itemErr;
        }
        totalItems += validItems.length;

        // holdings shares 업데이트 + cost_basis upsert
        for (const row of rows) {
          const holding = holdingMap.get(row.code);
          if (!holding) continue;

          // shares 업데이트
          await supabase
            .from("holdings")
            .update({ shares: holding.shares + row.quantity })
            .eq("id", holding.id);

          // 로컬 맵도 업데이트 (같은 날 여러 건 대응)
          holding.shares += row.quantity;

          // cost_basis upsert
          const { data: existing } = await supabase
            .from("cost_basis")
            .select("*")
            .eq("user_id", userId)
            .eq("holding_id", holding.id)
            .single();

          if (existing) {
            await supabase
              .from("cost_basis")
              .update({
                total_cost: existing.total_cost + row.amount,
                total_shares: existing.total_shares + row.quantity,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("cost_basis").insert({
              user_id: userId,
              holding_id: holding.id,
              total_cost: row.amount,
              total_shares: row.quantity,
            });
          }
        }
      }

      setResult(
        `${totalRecords}건의 매수 기록, ${totalItems}개 종목 데이터가 반영되었습니다.`
      );
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
