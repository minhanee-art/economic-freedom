import { Tabs } from "expo-router";
import { Platform, useWindowDimensions, type ColorValue } from "react-native";
import { TabIcon, TAB_ICON_SIZE, type TabIconName } from "@/components/TabIcon";
import { colors } from "@/styles/theme";

type TabBarIconProps = { color: ColorValue; size: number; focused: boolean };

function icon(name: TabIconName) {
  return function TabBarIcon(props: TabBarIconProps) {
    return <TabIcon name={name} {...props} />;
  };
}

/*
 * 탭 라벨 잘림 방지.
 * 기본 탭바(uikit)는 높이 49(하단 인셋 별도), 탭 안쪽 여백 위아래 5, 아이콘 래퍼 높이 28(아이콘 25 + 여유)로 고정이다.
 * 그래서 라벨에 남는 높이가 약 10px뿐인데, 라벨(fontSize 10)은 lineHeight 가 지정되지 않아 글꼴 기본 줄 높이를 쓴다.
 * 한글 대체 글꼴은 이 값이 커서(웹 실측 15px) 아랫부분이 잘린다.
 * → 아이콘 래퍼를 실제 아이콘 크기(25×25)로 줄이고 라벨 줄 높이를 13으로 고정한다. 5 + 25 + 13 + 5 = 48 로 기본 높이 안에 들어간다.
 * iOS 폰 가로 화면은 라이브러리가 compact 탭바(높이 32, 아이콘 18, 라벨은 아이콘 옆)로 바꾸므로 래퍼 크기를 건드리지 않는다.
 */
const LABEL_LINE_HEIGHT = 13;

export default function TabLayout() {
  const { width, height } = useWindowDimensions();
  // react-navigation BottomTabBar 의 isCompact 와 같은 조건(라벨 위치를 따로 지정하지 않은 경우)
  const compact = Platform.OS === "ios" && !Platform.isPad && width > height;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
        },
        tabBarIconStyle: compact ? undefined : { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE },
        tabBarLabelStyle: { lineHeight: LABEL_LINE_HEIGHT },
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
