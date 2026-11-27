import { Text as RNText, type TextProps } from "react-native";

/**
 * 앱의 모든 글자. iOS 에서 한글을 어절 단위로 줄바꿈한다(lineBreakStrategyIOS="hangul-word").
 * 웹 타깃은 styles/web-document.web.ts 의 word-break: keep-all 로 같은 결과를 낸다.
 * Android 는 React Native 가 어절 단위 줄바꿈 설정을 제공하지 않아 시스템 기본 줄바꿈을 따른다.
 */
export function Text({ lineBreakStrategyIOS = "hangul-word", ...props }: TextProps) {
  return <RNText lineBreakStrategyIOS={lineBreakStrategyIOS} {...props} />;
}
