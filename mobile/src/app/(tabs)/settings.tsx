import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { clearSession, loadSession } from "@/storage/session";
import { colors, radius, spacing } from "@/styles/theme";
import type { AuthSession } from "@/types";

export default function SettingsScreen() {
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshSession = useCallback(async () => {
    setSession(await loadSession());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const handleLogout = async () => {
    await clearSession();
    setSession(null);
    router.replace("/login");
  };

  return (
    <AppShell>
      <Text style={styles.title}>설정</Text>
      <Text style={styles.subtitle}>앱 정보, 계정 연결, 심사에 필요한 안내를 관리합니다.</Text>

      <Card title="계정">
        <InfoRow label="상태" value={session ? "연결됨" : "샘플 모드"} />
        <InfoRow label="이메일" value={session?.user.email ?? "로그인 필요"} />
        {session ? (
          <Pressable style={styles.secondaryButton} onPress={handleLogout}>
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
          </Pressable>
        ) : (
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>로그인하기</Text>
            </Pressable>
          </Link>
        )}
      </Card>

      <Card title="앱 정보">
        <InfoRow label="앱 이름" value="경제적 자유" />
        <InfoRow label="패키지" value="kr.kimvibe.economicfreedom" />
        <InfoRow label="제출 형식" value="Android App Bundle" />
      </Card>

      <Card title="심사 준비">
        <Text style={styles.bodyText}>개인정보처리방침과 계정 삭제 안내 페이지를 웹앱에 추가한 뒤 Play Console 데이터 보안 답변을 맞춥니다.</Text>
      </Card>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  infoValue: {
    flex: 1,
    color: colors.ink,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "900",
  },
  primaryButton: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    padding: spacing.lg,
  },
  primaryButtonText: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
  bodyText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
