import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/styles/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "로그인" }} />
        <Stack.Screen name="signup" options={{ title: "회원가입" }} />
        <Stack.Screen name="add-holding" options={{ title: "종목 추가" }} />
        <Stack.Screen name="record-purchase" options={{ title: "매수 기록 추가" }} />
        <Stack.Screen name="record-dividend" options={{ title: "배당 수령 기록 추가" }} />
        <Stack.Screen name="delete-account" options={{ title: "계정 삭제" }} />
      </Stack>
    </>
  );
}
