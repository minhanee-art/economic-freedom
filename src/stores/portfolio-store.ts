import { create } from "zustand";
import type { Holding, PurchaseRecord, Dividend, CostBasis } from "@/types";

interface PortfolioState {
  holdings: Holding[];
  purchaseRecords: PurchaseRecord[];
  dividends: Dividend[];
  costBases: CostBasis[];
  isLoading: boolean;

  setHoldings: (items: Holding[]) => void;
  setPurchaseRecords: (records: PurchaseRecord[]) => void;
  setDividends: (divs: Dividend[]) => void;
  setCostBases: (bases: CostBasis[]) => void;
  setLoading: (loading: boolean) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: [],
  purchaseRecords: [],
  dividends: [],
  costBases: [],
  isLoading: false,

  setHoldings: (items) => set({ holdings: items }),
  setPurchaseRecords: (records) => set({ purchaseRecords: records }),
  setDividends: (divs) => set({ dividends: divs }),
  setCostBases: (bases) => set({ costBases: bases }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
