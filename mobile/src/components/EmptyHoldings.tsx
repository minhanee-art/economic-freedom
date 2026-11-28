import { router } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmojiLine } from "@/components/InfoTip";

/**
 * 종목이 하나도 없는 계좌의 빈 상태. 새 계정은 종목 없이 시작하므로 앱에서 바로 '종목 추가'로 보낸다.
 * 0원·0% 같은 계산 결과 대신 이 안내를 보인다. description 은 이모지 한 줄(20자 안팎).
 */
export function EmptyHoldings({ description }: { description: string }) {
  return (
    <Card title="아직 종목이 없습니다">
      <EmojiLine emoji="🗂️">{description}</EmojiLine>
      <Button label="종목 추가" compact onPress={() => router.push("/add-holding")} />
    </Card>
  );
}
