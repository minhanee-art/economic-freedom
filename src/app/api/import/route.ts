import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ImportItem {
  date: string;
  code: string;
  name: string;
  type?: string; // 매수 | 매도 | 배당
  qty: number;
  price: number;
  amount: number;
}

/** 거래내역 일괄 등록 API (매수/매도/배당 + 중복 필터) */
export async function POST(request: Request) {
  try {
    const { items, skipDuplicates = true } = (await request.json()) as {
      items: ImportItem[];
      skipDuplicates?: boolean;
    };
    if (!items?.length) {
      return NextResponse.json({ error: "데이터 없음" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    // 현재 holdings 조회
    const { data: holdings } = await supabase
      .from("holdings")
      .select("id, code, shares")
      .eq("user_id", user.id);

    const holdingMap = new Map(
      (holdings ?? []).map((h) => [h.code, h])
    );

    // ── 중복 체크를 위한 기존 데이터 로드 ──
    let existingBuyKeys = new Set<string>();
    let existingDividendKeys = new Set<string>();

    if (skipDuplicates) {
      // 기존 매수 기록: date+code+quantity+price 조합
      const { data: existingItems } = await supabase
        .from("purchase_items")
        .select("code, quantity, price_at_purchase, purchase_records!inner(date, user_id)")
        .eq("purchase_records.user_id", user.id);

      (existingItems ?? []).forEach((item: any) => {
        const key = `${item.purchase_records.date}|${item.code}|${item.quantity}|${item.price_at_purchase}`;
        existingBuyKeys.add(key);
      });

      // 기존 배당 기록: date+holding_id+amount 조합
      const { data: existingDividends } = await supabase
        .from("dividends")
        .select("holding_id, amount, date, holdings!inner(code)")
        .eq("user_id", user.id);

      (existingDividends ?? []).forEach((d: any) => {
        const key = `${d.date}|${d.holdings.code}|${d.amount}`;
        existingDividendKeys.add(key);
      });
    }

    // 타입별 분류
    const buyItems = items.filter((i) => !i.type || i.type === "매수");
    const sellItems = items.filter((i) => i.type === "매도");
    const dividendItems = items.filter((i) => i.type === "배당");

    let buyCount = 0;
    let sellCount = 0;
    let dividendCount = 0;
    let totalRecords = 0;
    let dupSkipped = 0;
    const autoAdded: string[] = [];

    // ── Helper: 종목 조회 또는 자동 생성 ──
    async function getOrCreateHolding(item: ImportItem) {
      let holding = holdingMap.get(item.code);
      if (!holding) {
        const { data: newHolding, error: addErr } = await supabase
          .from("holdings")
          .insert({
            user_id: user!.id,
            code: item.code,
            name: item.name,
            category: "주식",
            sub_category: "기타",
            current_price: item.price || 0,
            target_pct: 0,
          })
          .select("id, code, shares")
          .single();

        if (addErr) throw addErr;
        holding = newHolding;
        holdingMap.set(item.code, holding);
        autoAdded.push(`${item.name}(${item.code})`);
      }
      return holding;
    }

    // ── 매수 처리 ──
    if (buyItems.length > 0) {
      // 중복 필터
      const filteredBuys = skipDuplicates
        ? buyItems.filter((row) => {
            const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
            if (existingBuyKeys.has(key)) {
              dupSkipped++;
              return false;
            }
            return true;
          })
        : buyItems;

      const dateGroups = new Map<string, ImportItem[]>();
      filteredBuys.forEach((item) => {
        const group = dateGroups.get(item.date) ?? [];
        group.push(item);
        dateGroups.set(item.date, group);
      });

      for (const [date, rows] of dateGroups) {
        const totalSpent = rows.reduce((s, r) => s + r.amount, 0);

        const { data: record, error: recErr } = await supabase
          .from("purchase_records")
          .insert({
            user_id: user.id,
            date,
            total_spent: totalSpent,
            total_value_after: 0,
          })
          .select("id")
          .single();

        if (recErr) throw recErr;
        totalRecords++;

        for (const row of rows) {
          const holding = await getOrCreateHolding(row);

          await supabase.from("purchase_items").insert({
            record_id: record.id,
            holding_id: holding.id,
            code: row.code,
            name: row.name,
            quantity: row.qty,
            price_at_purchase: row.price,
            cost: row.amount,
          });

          await supabase
            .from("holdings")
            .update({ shares: holding.shares + row.qty })
            .eq("id", holding.id);
          holding.shares += row.qty;

          // cost_basis upsert
          const { data: cb } = await supabase
            .from("cost_basis")
            .select("*")
            .eq("user_id", user.id)
            .eq("holding_id", holding.id)
            .single();

          if (cb) {
            await supabase
              .from("cost_basis")
              .update({
                total_cost: cb.total_cost + row.amount,
                total_shares: cb.total_shares + row.qty,
              })
              .eq("id", cb.id);
          } else {
            await supabase.from("cost_basis").insert({
              user_id: user.id,
              holding_id: holding.id,
              total_cost: row.amount,
              total_shares: row.qty,
            });
          }

          buyCount++;
        }
      }
    }

    // ── 매도 처리 ──
    for (const row of sellItems) {
      if (skipDuplicates) {
        const key = `${row.date}|${row.code}|${row.qty}|${row.price}`;
        if (existingBuyKeys.has(key)) {
          dupSkipped++;
          continue;
        }
      }

      const holding = await getOrCreateHolding(row);

      const newShares = Math.max(0, holding.shares - row.qty);
      await supabase
        .from("holdings")
        .update({ shares: newShares })
        .eq("id", holding.id);

      const { data: cb } = await supabase
        .from("cost_basis")
        .select("*")
        .eq("user_id", user.id)
        .eq("holding_id", holding.id)
        .single();

      if (cb && cb.total_shares > 0) {
        const avgCost = cb.total_cost / cb.total_shares;
        const costReduction = Math.round(avgCost * row.qty);
        await supabase
          .from("cost_basis")
          .update({
            total_cost: Math.max(0, cb.total_cost - costReduction),
            total_shares: Math.max(0, cb.total_shares - row.qty),
          })
          .eq("id", cb.id);
      }

      holding.shares = newShares;
      sellCount++;
    }

    // ── 배당 처리 ──
    for (const row of dividendItems) {
      const holding = await getOrCreateHolding(row);

      if (skipDuplicates) {
        const key = `${row.date}|${holding.code}|${row.amount}`;
        if (existingDividendKeys.has(key)) {
          dupSkipped++;
          continue;
        }
      }

      await supabase.from("dividends").insert({
        user_id: user.id,
        holding_id: holding.id,
        amount: row.amount,
        date: row.date,
        memo: "CSV 자동 등록",
      });

      dividendCount++;
    }

    return NextResponse.json({
      success: true,
      totalRecords,
      buyCount,
      sellCount,
      dividendCount,
      dupSkipped,
      autoAdded: [...new Set(autoAdded)],
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
