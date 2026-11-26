import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import Constants from "expo-constants";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PasswordCard } from "@/components/PasswordCard";
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
      <Text style={styles.subtitle}>계정과 앱 정보를 관리합니다.</Text>

      <Card title="계정">
        <InfoRow label="상태" value={session ? "연결됨" : "로그아웃됨"} />
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

      {session ? <PasswordCard session={session} onSessionChange={setSession} /> : null}

      <Card title="앱 정보">
        <InfoRow label="앱 이름" value="가족연금계획" />
        <InfoRow label="버전" value={Constants.expoConfig?.version ?? "-"} />
      </Card>

      <Card title="약관 및 안내">
        <LinkRow label="개인정보처리방침" url={webUrl("/privacy")} />
        <LinkRow label="계정 삭제 안내" url={webUrl("/account-deletion")} />
      </Card>

      {session ? (
        <Link href="/delete-account" asChild>
          <Pressable style={styles.dangerButton}>
            <Text style={styles.dangerButtonText}>계정 삭제</Text>
          </Pressable>
        </Link>
      ) : null}
    </AppShell>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.linkValue}>열기 ›</Text>
    </Pressable>
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
  linkValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  dangerButton: {
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  dangerButtonText: {
    color: colors.negative,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
});
