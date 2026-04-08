import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ImportItem {
  date: string;
  code: string;
  name: string;
  qty: number;
  price: number;
  amount: number;
}

/** 거래내역 일괄 등록 API */
export async function POST(request: Request) {
  try {
    const { items } = (await request.json()) as { items: ImportItem[] };
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

    // 날짜별 그룹핑
    const dateGroups = new Map<string, ImportItem[]>();
    items.forEach((item) => {
      const group = dateGroups.get(item.date) ?? [];
      group.push(item);
      dateGroups.set(item.date, group);
    });

    let totalRecords = 0;
    let totalItems = 0;
    const autoAdded: string[] = [];

    for (const [date, rows] of dateGroups) {
      const totalSpent = rows.reduce((s, r) => s + r.amount, 0);

      // purchase_records
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
        let holding = holdingMap.get(row.code);
        if (!holding) {
          // 미등록 종목 자동 추가
          const { data: newHolding, error: addErr } = await supabase
            .from("holdings")
            .insert({
              user_id: user.id,
              code: row.code,
              name: row.name,
              category: "주식",
              sub_category: "기타",
              current_price: row.price || 0,
              target_pct: 0,
            })
            .select("id, code, shares")
            .single();

          if (addErr) throw addErr;
          holding = newHolding;
          holdingMap.set(row.code, holding);
          autoAdded.push(`${row.name}(${row.code})`);
        }

        // purchase_items
        await supabase.from("purchase_items").insert({
          record_id: record.id,
          holding_id: holding.id,
          code: row.code,
          name: row.name,
          quantity: row.qty,
          price_at_purchase: row.price,
          cost: row.amount,
        });

        // holdings shares 업데이트
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

        totalItems++;
      }
    }

    return NextResponse.json({
      success: true,
      totalRecords,
      totalItems,
      autoAdded: [...new Set(autoAdded)],
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
