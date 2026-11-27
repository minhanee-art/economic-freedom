// 홈 첫 사용 안내의 단계 정의 — 서버/클라이언트 공용(DB·next/headers import 금지).
// 완료 여부는 새 컬럼 없이 기존 데이터(계좌 세제 유형·종목·매수 기록·은퇴 목표)에서 유도한다.

export type OnboardingFacts = {
  /** 연금저축·IRP·DC 계좌가 하나라도 있다 */
  hasPensionAccount: boolean;
  /** 어느 계좌든 종목이 하나라도 있다 */
  hasHoldings: boolean;
  /** 매수 기록이 있거나 수량이 있는 종목이 있다 */
  hasPurchase: boolean;
  /** 은퇴 목표 월 생활비를 입력했다 */
  hasRetirementGoal: boolean;
};

export type OnboardingStep = {
  key: "pension-account" | "first-purchase" | "retirement-goal";
  title: string;
  description: string;
  done: boolean;
  href: string;
  actionLabel: string;
};

export const ONBOARDING_HIDDEN_COOKIE = "pension-onboarding-hidden";
/** 안내를 진행 중 상태로 한 번이라도 본 사람에게만 완료 한 줄을 보여 주기 위한 표시 */
export const ONBOARDING_STARTED_COOKIE = "pension-onboarding-started";
/** 완료 한 줄을 이미 보여 줬다 */
export const ONBOARDING_DONE_SEEN_COOKIE = "pension-onboarding-done-seen";

export function buildOnboardingSteps(facts: OnboardingFacts): OnboardingStep[] {
  return [
    {
      key: "pension-account",
      title: "연금 계좌 등록",
      description: "연금저축·IRP·DC 계좌를 새로 만들거나, 기존 계좌의 세제 유형을 지정합니다.",
      done: facts.hasPensionAccount,
      href: "/dashboard/retirement#account-types",
      actionLabel: "계좌 등록",
    },
    {
      key: "first-purchase",
      title: "종목 추가와 첫 매수 기록",
      description: "가지고 있는 종목을 추가하고, 이미 산 수량과 단가를 기록합니다. 기록만 저장되며 주문은 실행되지 않습니다.",
      done: facts.hasHoldings && facts.hasPurchase,
      href: "/dashboard#holdings",
      actionLabel: facts.hasHoldings ? "매수 기록" : "종목 추가",
    },
    {
      key: "retirement-goal",
      title: "은퇴 목표 입력",
      description: "목표 월 생활비와 은퇴 나이를 넣으면 연금 설계에서 예상 월 현금흐름을 계산합니다.",
      done: facts.hasRetirementGoal,
      href: "/dashboard/retirement#retirement-goal",
      actionLabel: "목표 입력",
    },
  ];
}

/** 세 단계를 모두 마쳤으면 안내를 보여 주지 않는다. */
export function isOnboardingComplete(facts: OnboardingFacts): boolean {
  return buildOnboardingSteps(facts).every((step) => step.done);
}
