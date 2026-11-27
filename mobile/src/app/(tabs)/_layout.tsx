import { Tabs } from "expo-router";
import { useWindowDimensions, type ColorValue } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, TAB_ICON_SIZE, type TabIconName } from "@/components/TabIcon";
import { colors } from "@/styles/theme";

type TabBarIconProps = { color: ColorValue; size: number; focused: boolean };
type TabBarLabelProps = { color: ColorValue; children: string; position: "beside-icon" | "below-icon" };

function icon(name: TabIconName) {
  return function TabBarIcon(props: TabBarIconProps) {
    return <TabIcon name={name} {...props} />;
  };
}

/*
 * 탭바 높이 계산(라벨 12px, 큰 글씨 포함).
 *
 * 라이브러리 기본 탭바(uikit)는 높이 49(+하단 인셋)로 고정이고, 세로 배치 탭은 위아래 안쪽 여백 5, 아이콘 래퍼 25(아이콘 크기로 맞춤)다.
 * 기본 라벨은 10px 라 49 안에 들어갔지만 12px 로 올리면 넘친다. 그래서 높이를 덮지 않고 구성 요소의 합으로 다시 계산한다:
 *
 *   높이 = 여백 5 + 아이콘 25 + 라벨 줄 높이 + 여백 5 + 하단 인셋
 *   라벨 줄 높이 = ceil(16 × min(시스템 글씨 배율, 1.3))
 *
 * 라벨은 글씨 배율을 따르되 maxFontSizeMultiplier 1.3 에서 멈춘다. React Native 는 글자 크기와 줄 높이에 같은 배율(상한 포함)을 곱하므로,
 * 위 식의 줄 높이가 실제로 그려지는 라벨 줄 높이와 같다 — 어떤 글씨 배율에서도 라벨이 탭 영역 안에 들어간다(배율 1: 51, 1.3 이상: 56).
 *
 * 폰(폭 768 미만)은 가로 화면에서도 라벨을 아이콘 아래에 둔다(라이브러리의 가로 compact 배치를 쓰지 않아 위 식 하나로 끝난다).
 * 태블릿·넓은 웹(768 이상)은 라벨이 아이콘 옆에 오므로 라이브러리 기본 높이(49)를 그대로 쓴다 — 옆 배치는 줄 높이 16 이 49 안에 여유 있게 들어간다.
 */
const TAB_PADDING = 5;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 16;
const LABEL_MAX_SCALE = 1.3;

function TabLabel({ color, children, position }: TabBarLabelProps) {
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={LABEL_MAX_SCALE}
      numberOfLines={1}
      style={{
        color,
        fontSize: LABEL_FONT_SIZE,
        lineHeight: LABEL_LINE_HEIGHT,
        fontWeight: "500",
        textAlign: "center",
        marginStart: position === "beside-icon" ? 8 : 0,
      }}
    >
      {children}
    </Text>
  );
}

export default function TabLayout() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const besideIcon = width >= 768;
  const labelHeight = Math.ceil(LABEL_LINE_HEIGHT * Math.min(fontScale || 1, LABEL_MAX_SCALE));
  const belowIconHeight = TAB_PADDING + TAB_ICON_SIZE + labelHeight + TAB_PADDING + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelPosition: besideIcon ? "beside-icon" : "below-icon",
        tabBarLabel: TabLabel,
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
          ...(besideIcon ? null : { height: belowIconHeight }),
        },
        tabBarIconStyle: besideIcon ? undefined : { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: icon("home"), title: "홈" }} />
      <Tabs.Screen name="holdings" options={{ tabBarIcon: icon("holdings"), title: "자산" }} />
      <Tabs.Screen name="dividends" options={{ tabBarIcon: icon("dividends"), title: "배당" }} />
      <Tabs.Screen name="retirement" options={{ tabBarIcon: icon("retirement"), title: "연금" }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: icon("settings"), title: "설정" }} />
    </Tabs>
  );
}
