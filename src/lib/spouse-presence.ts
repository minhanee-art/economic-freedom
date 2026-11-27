// 배우자 데이터가 있는지 — 배우자 입력란·안내를 보일지 정할 때 쓴다(계산에는 쓰지 않는다).
// 별도 '배우자 있음' 컬럼 없이 이미 저장된 값에서 유도한다.
import { normalizeAccountOwner } from "./pension-planning";

export interface SpousePresenceInput {
  goal: { spouseBirthYear: number | null; spouseSalaryBracket: string | null };
  accounts: { owner_type: string | null | undefined }[];
  sources: { member: string }[];
}

export interface SpousePresence {
  /** 배우자 출생연도 또는 배우자 총급여 구간이 저장되어 있다 */
  goalFields: boolean;
  spouseAccountCount: number;
  spouseSourceCount: number;
  /** 위 중 하나라도 있으면 true */
  any: boolean;
}

export function getSpousePresence({ goal, accounts, sources }: SpousePresenceInput): SpousePresence {
  const goalFields = goal.spouseBirthYear !== null || goal.spouseSalaryBracket !== null;
  const spouseAccountCount = accounts.filter((a) => normalizeAccountOwner(a.owner_type) === "spouse").length;
  const spouseSourceCount = sources.filter((s) => s.member === "spouse").length;
  return {
    goalFields,
    spouseAccountCount,
    spouseSourceCount,
    any: goalFields || spouseAccountCount > 0 || spouseSourceCount > 0,
  };
}
