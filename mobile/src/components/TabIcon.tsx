import { SymbolView, type SFSymbol, type AndroidSymbol } from "expo-symbols";
import type { ColorValue } from "react-native";

/**
 * 하단 탭 아이콘. expo-symbols(expo-router 가 이미 의존하는 패키지)를 쓴다:
 * iOS는 SF Symbols, Android·웹은 Material Symbols 글꼴로 그린다. 새 네이티브 의존성은 없다.
 * 아이콘은 장식이라 스크린리더·접근성 이름에서 뺀다(탭 이름은 제목 글자로 읽힌다).
 */
export type TabIconName = "home" | "holdings" | "dividends" | "retirement" | "settings";

const SYMBOLS: Record<TabIconName, { ios: SFSymbol; iosActive: SFSymbol; android: AndroidSymbol }> = {
  home: { ios: "house", iosActive: "house.fill", android: "home" },
  holdings: { ios: "chart.pie", iosActive: "chart.pie.fill", android: "pie_chart" },
  dividends: { ios: "wonsign.circle", iosActive: "wonsign.circle.fill", android: "payments" },
  retirement: { ios: "building.columns", iosActive: "building.columns.fill", android: "account_balance" },
  settings: { ios: "gearshape", iosActive: "gearshape.fill", android: "settings" },
};

export function TabIcon({ name, color, size, focused }: { name: TabIconName; color: ColorValue; size: number; focused: boolean }) {
  const symbol = SYMBOLS[name];
  return (
    <SymbolView
      name={{ ios: focused ? symbol.iosActive : symbol.ios, android: symbol.android, web: symbol.android }}
      tintColor={color}
      size={size}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
