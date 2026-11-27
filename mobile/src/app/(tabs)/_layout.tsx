import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { TabIcon, type TabIconName } from "@/components/TabIcon";
import { colors } from "@/styles/theme";

type TabBarIconProps = { color: ColorValue; size: number; focused: boolean };

function icon(name: TabIconName) {
  return function TabBarIcon(props: TabBarIconProps) {
    return <TabIcon name={name} {...props} />;
  };
}

export default function TabLayout() {
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
