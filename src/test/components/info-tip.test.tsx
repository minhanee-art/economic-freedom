import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let mod: typeof import("@/components/ui/info-tip");

before(async () => {
  setupDom();
  ({ render, screen, fireEvent, cleanup } = await import("@testing-library/react"));
  mod = await import("@/components/ui/info-tip");
});

beforeEach(() => cleanup());

test("InfoTip: 누르면 열리고 다시 누르면 닫힌다(aria-expanded·aria-controls)", () => {
  render(
    <p>
      기간별 수익률 <mod.InfoTip label="기간별 수익률 설명">참고용 계산입니다.</mod.InfoTip>
    </p>
  );
  const btn = screen.getByRole("button", { name: "기간별 수익률 설명" });
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByText("참고용 계산입니다."), null);

  fireEvent.click(btn);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  const bubble = screen.getByText("참고용 계산입니다.").closest("[popover]");
  assert.ok(bubble);
  assert.equal(btn.getAttribute("aria-controls"), bubble.id);
  assert.equal(btn.nextElementSibling, bubble, "말풍선은 DOM 에서 버튼 바로 뒤");

  fireEvent.click(btn);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
});

test("InfoTip: Esc·바깥 누르기로 닫히고, 하나가 열리면 다른 말풍선은 닫힌다", () => {
  render(
    <div>
      <span data-testid="outside">바깥</span>
      <mod.InfoTip label="첫 설명">첫 내용</mod.InfoTip>
      <mod.InfoTip label="둘째 설명">둘째 내용</mod.InfoTip>
    </div>
  );
  const first = screen.getByRole("button", { name: "첫 설명" });
  const second = screen.getByRole("button", { name: "둘째 설명" });

  fireEvent.click(first);
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(first.getAttribute("aria-expanded"), "false");

  fireEvent.click(first);
  fireEvent.pointerDown(screen.getByTestId("outside"));
  assert.equal(first.getAttribute("aria-expanded"), "false");

  fireEvent.click(first);
  fireEvent.click(second);
  assert.equal(first.getAttribute("aria-expanded"), "false");
  assert.equal(second.getAttribute("aria-expanded"), "true");
});

test("EmojiLine: 이모지는 aria-hidden, 뜻은 글자가 전한다", () => {
  render(
    <mod.EmojiList>
      <mod.EmojiLine emoji="🧾">세액공제 한도 채우기</mod.EmojiLine>
    </mod.EmojiList>
  );
  const item = screen.getByRole("listitem");
  assert.equal(item.textContent, "🧾세액공제 한도 채우기");
  assert.equal(item.querySelector("[aria-hidden='true']")?.textContent, "🧾");
});
