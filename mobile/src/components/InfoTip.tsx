import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/AppText";
import { colors, radius, spacing, touchTarget, type } from "@/styles/theme";

// InfoTip — 라벨 옆 ⓘ 선 아이콘 버튼 + 말풍선. EmojiLine — 이모지 그림 + 글자 한 줄. (웹: src/components/ui/info-tip.tsx)
// 사용 예:
//   <Card title="월별 흐름" info={<InfoTip label="월별 흐름 설명">가로축은 월, 세로축은 금액입니다.</InfoTip>}>
//   <TextField label="종목코드" info="증권사 앱의 종목 상세에 나오는 코드입니다." … />
//   <Notice info={{ label: "납입 기록 설명", text: "…" }}>올해 납입 기록이 없습니다.</Notice>
//   <EmojiList><EmojiLine emoji="🧾">세액공제 한도 채우기</EmojiLine></EmojiList>
// 말풍선 문구(children)는 글자 1~3문장. 오류·삭제 확인 내용·"참고용" 표시는 말풍선에 숨기지 않는다.
//
// 동작: 누르면 열림. 열린 동안 화면 전체를 덮는 투명한 바탕이 있어 다시 누르기(버튼 자리)·바깥 누르기 모두 닫기이고,
// 안드로이드 뒤로 가기·웹 Esc 는 Modal 의 onRequestClose 로 닫는다. 바탕이 다른 ⓘ 도 덮으므로 한 번에 하나만 열린다.
// 말풍선은 Modal(화면 최상위)에 그려 ScrollView·카드에 잘리지 않고, 버튼의 창 좌표(measureInWindow)에 붙여 화면 안으로 당긴다.

const VIEWPORT_GAP = 8; // 화면 가장자리와 말풍선 사이 최소 여백
const BUBBLE_MAX = 288;
const ICON = 16;
const OFFSET = 6; // 아이콘과 말풍선 사이
const ARROW = 10;

// 한 번에 하나만 — 새로 열리면 앞서 열린 것을 닫는다(바탕이 덮어 보통은 생기지 않지만, 프로그램으로 여는 경우 대비).
let closeActiveTip: (() => void) | null = null;

/** 버튼 가운데의 창 좌표와, 잴 때의 창 크기 */
type Anchor = { cx: number; cy: number; vw: number; vh: number };

export function InfoTip({
  label,
  children,
  side: preferredSide = "bottom",
}: {
  /** 버튼의 접근성 이름. 무엇에 대한 설명인지(예: "월별 흐름 설명"). */
  label: string;
  /** 말풍선 내용(글자만, 1~3문장). 열릴 때 화면 낭독기가 읽는다. */
  children: string;
  /** 말풍선이 열리는 쪽. 숫자를 설명할 때는 top 으로 숫자를 가리지 않는다. 공간이 모자라면 반대쪽. */
  side?: "top" | "bottom";
}) {
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [bubble, setBubble] = useState<{ w: number; h: number } | null>(null);
  const { width: vw, height: vh } = useWindowDimensions();
  // 화면 회전·창 크기 변화(40 이상)가 있으면 좌표가 어긋나므로 닫힌 것으로 본다.
  const open = anchor !== null && Math.abs(anchor.vw - vw) < 40 && Math.abs(anchor.vh - vh) < 40;

  const close = useCallback(() => {
    setAnchor(null);
    setBubble(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (closeActiveTip && closeActiveTip !== close) closeActiveTip();
    closeActiveTip = close;
    // 네이티브 낭독기: 말풍선 내용을 바로 읽는다(웹은 aria-live 로 읽힌다).
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(children);
    return () => {
      if (closeActiveTip === close) closeActiveTip = null;
    };
  }, [open, close, children]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    buttonRef.current?.measureInWindow((x, y, w, h) => {
      setBubble(null);
      setAnchor({ cx: x + w / 2, cy: y + h / 2, vw, vh });
    });
  };

  const maxWidth = Math.min(BUBBLE_MAX, vw - VIEWPORT_GAP * 2);
  let position: ViewStyle = { left: VIEWPORT_GAP, top: 0, opacity: 0 };
  let arrowLeft = 0;
  let placedSide: "top" | "bottom" = preferredSide;
  if (open && anchor && bubble) {
    const left = Math.max(VIEWPORT_GAP, Math.min(anchor.cx - bubble.w / 2, vw - VIEWPORT_GAP - bubble.w));
    const below = anchor.cy + ICON / 2 + OFFSET;
    const above = anchor.cy - ICON / 2 - OFFSET - bubble.h;
    const fitsBelow = below + bubble.h <= vh - VIEWPORT_GAP;
    const fitsAbove = above >= VIEWPORT_GAP;
    placedSide =
      preferredSide === "top" ? (fitsAbove || !fitsBelow ? "top" : "bottom") : fitsBelow || !fitsAbove ? "bottom" : "top";
    const top = Math.max(VIEWPORT_GAP, placedSide === "bottom" ? below : above);
    position = { left: Math.round(left), top: Math.round(top), opacity: 1 };
    arrowLeft = Math.round(Math.max(ARROW, Math.min(anchor.cx - left, bubble.w - ARROW)) - ARROW / 2);
  }

  const onBubbleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBubble((prev) => (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }));
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={toggle}
        style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
      >
        <View style={[styles.iconBox, open ? styles.iconBoxOpen : null]}>
          <SymbolView
            name={{ ios: "info.circle", android: "info", web: "info" }}
            tintColor={open ? colors.primary : colors.inkMuted}
            size={ICON}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.layer}>
          {/* 말풍선을 먼저 둔다 — 열리면 낭독기 초점이 '닫기' 바탕보다 내용에 먼저 간다. 그리기 순서는 zIndex 로 위에. */}
          <View
            style={[styles.bubble, { maxWidth }, position]}
            onLayout={onBubbleLayout}
            accessibilityViewIsModal
            accessible
            accessibilityRole="text"
            accessibilityLabel={children}
            accessibilityLiveRegion="polite"
            aria-live="polite"
          >
            <View
              style={[styles.arrow, placedSide === "bottom" ? styles.arrowTop : styles.arrowBottom, { left: arrowLeft }]}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text style={styles.bubbleText}>{children}</Text>
          </View>
          <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="설명 닫기" />
        </View>
      </Modal>
    </>
  );
}

const EMOJI_SIZE = {
  body: { fontSize: 15, lineHeight: 22 },
  sm: { fontSize: 13, lineHeight: 20 },
} as const;
const EMOJI_TONE = { ink: colors.ink, mute: colors.inkMuted } as const;

/**
 * 이모지 그림 + 글자 한 줄. 이모지는 낭독기에서 숨기고 뜻은 글자가 전한다. 한 줄에 이모지 1개, 20자 안팎.
 * trailing 에는 줄 끝에 붙일 InfoTip 을 둘 수 있다(이때 줄 높이는 44 이상이 되어 ⓘ 가 촘촘히 쌓이지 않는다).
 */
export function EmojiLine({
  emoji,
  children,
  size = "body",
  tone = "mute",
  align = "start",
  trailing,
  style,
}: {
  emoji: string;
  children: ReactNode;
  size?: keyof typeof EMOJI_SIZE;
  tone?: keyof typeof EMOJI_TONE;
  align?: "start" | "center";
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const text = { ...EMOJI_SIZE[size], color: EMOJI_TONE[tone] };
  return (
    <View style={[styles.emojiLine, align === "center" ? styles.emojiLineCenter : null, trailing ? styles.withTip : null, style]}>
      <Text
        style={[styles.emoji, { fontSize: text.fontSize, lineHeight: text.lineHeight }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {emoji}
      </Text>
      <Text style={[type.body, text, align === "center" ? styles.emojiTextCenter : styles.emojiText]}>{children}</Text>
      {trailing}
    </View>
  );
}

/** EmojiLine 묶음. 줄 사이 8. */
export function EmojiList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.emojiList, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  // 누르는 영역 44×44. 줄 높이를 밀지 않게 세로는 음수 margin 으로 겹치고, 왼쪽은 글자와 4 띄운다.
  button: {
    width: touchTarget,
    height: touchTarget,
    marginVertical: -(touchTarget - 24) / 2,
    marginLeft: -(touchTarget - ICON) / 2 + 4,
    marginRight: -(touchTarget - ICON) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.6 },
  iconBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  iconBoxOpen: { backgroundColor: colors.primarySoft },
  layer: { flex: 1 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  bubble: {
    position: "absolute",
    zIndex: 2,
    elevation: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    boxShadow: `0 4px 16px ${colors.shadow}`,
  },
  bubbleText: { fontSize: 13, lineHeight: 20, color: colors.ink },
  arrow: {
    position: "absolute",
    width: ARROW,
    height: ARROW,
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
    transform: [{ rotate: "45deg" }],
  },
  arrowTop: { top: -ARROW / 2, borderLeftWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth },
  arrowBottom: { bottom: -ARROW / 2, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  emojiList: { gap: spacing.sm },
  emojiLine: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  emojiLineCenter: { justifyContent: "center" },
  withTip: { alignItems: "center", minHeight: touchTarget },
  emoji: { width: 22, textAlign: "center" },
  emojiText: { flex: 1 },
  emojiTextCenter: { flexShrink: 1, textAlign: "center" },
});
