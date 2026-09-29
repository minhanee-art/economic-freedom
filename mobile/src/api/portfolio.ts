import { apiGet } from "./client";
import type { PortfolioSummary } from "@/types";

export function getMobilePortfolioSummary(token: string): Promise<PortfolioSummary> {
  return apiGet<PortfolioSummary>("/api/mobile/portfolio-summary", token);
}
