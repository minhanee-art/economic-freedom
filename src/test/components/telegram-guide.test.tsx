import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { TelegramGuide } from "@/components/guide/telegram-guide";
import { getBotUsername } from "@/lib/telegram-bot-username";

const render = (botUsername: string | null) => renderToStaticMarkup(createElement(TelegramGuide, { botUsername }));

test("봇 사용자명이 있으면 t.me 링크로 안내한다", () => {
  const html = render("family_bot");
  assert.match(html, /href="https:\/\/t\.me\/family_bot"/);
  assert.match(html, /@family_bot/);
  assert.doesNotMatch(html, /설정 화면에 표시되는 봇/);
});

test("봇 사용자명이 없으면 링크 없이 설정 화면의 봇으로 안내한다", () => {
  const html = render(null);
  assert.doesNotMatch(html, /t\.me/);
  assert.match(html, /설정 화면에 표시되는 봇/);
});

test("단계·버튼 이름·제한·개인정보처리방침 링크가 들어 있다", () => {
  const html = render(null);
  for (const text of ["연결 코드 발급", "연결 상태 새로고침", "연결 해제", "새 코드 발급", "텔레그램 전송", "10분", "chat_id", "해시"]) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /href="\/privacy"/);
});

test("정기 리포트·AI 대화는 받지 않는 것으로 안내한다", () => {
  const html = render(null);
  assert.match(html, /받지 않는 것/);
  assert.match(html, /정기 리포트/);
});

test("getBotUsername은 형식이 맞을 때만 값을 낸다", () => {
  assert.equal(getBotUsername({ TELEGRAM_BOT_USERNAME: " @family_bot " } as never), "family_bot");
  assert.equal(getBotUsername({ TELEGRAM_BOT_USERNAME: "a b" } as never), null);
  assert.equal(getBotUsername({} as never), null);
});
