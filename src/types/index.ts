// ============================================
// Database 테이블 타입
// ============================================

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  monthly_budget: number;
  last_price_update: string | null;
  created_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  code: string;
  name: string;
  category: string;       // 주식 | 리츠 | 원자재 | 채권
  sub_category: string;   // 국장 | 배당 | 인도 | 금 등
  current_price: number;
  shares: number;
  target_pct: number;
  expense_ratio: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  date: string;
  total_spent: number;
  total_value_after: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  record_id: string;
  holding_id: string;
  code: string;
  name: string;
  quantity: number;
  price_at_purchase: number;
  cost: number;
}

export interface Dividend {
  id: string;
  user_id: string;
  holding_id: string;
  amount: number;
  date: string;
  memo: string | null;
  created_at: string;
}

export interface CostBasis {
  id: string;
  user_id: string;
  holding_id: string;
  total_cost: number;
  total_shares: number;
  updated_at: string;
}

// ============================================
// 화면 표시용 파생 타입
// ============================================

export interface HoldingWithPnL extends Holding {
  total_cost: number;
  avg_price: number;
  current_value: number;
  profit_loss: number;
  profit_loss_pct: number;
  actual_pct: number;     // 실제 비중
}

export interface PurchaseRecordWithItems extends PurchaseRecord {
  items: PurchaseItem[];
}

export interface DividendWithHolding extends Dividend {
  holding_name: string;
  holding_code: string;
}

// ============================================
// 자녀 계좌 / 증여 관리 타입
// ============================================

export interface Child {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  created_at: string;
}

export type GiftType = "lump" | "installment" | "government_support";

export interface ChildGift {
  id: string;
  child_id: string;
  user_id: string;
  date: string;
  amount: number;
  gift_type: GiftType;
  reported: boolean;
  report_date: string | null;
  memo: string | null;
  created_at: string;
}

export interface ChildHolding {
  id: string;
  child_id: string;
  user_id: string;
  code: string;
  name: string;
  shares: number;
  avg_price: number;
  current_price: number;
  created_at: string;
  updated_at: string;
}
