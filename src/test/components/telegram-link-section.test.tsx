import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let cleanup: typeof import("@testing-library/react").cleanup;
let TelegramLinkSection: typeof import("@/components/settings/telegram-link-section").TelegramLinkSection;

const realFetch = globalThis.fetch;

before(async () => {
  setupDom();
  const rtl = await import("@testing-library/react");
  ({ render, screen, cleanup } = rtl);
  ({ TelegramLinkSection } = await import("@/components/settings/telegram-link-section"));
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  cleanup();
});

function mockStatus(status: Record<string, unknown>) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(status), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
}

for (const [name, status] of [
  ["연결 전", { accountName: "내 계좌", linked: false, chatIdMasked: null, verifiedAt: null, needsRelink: false, botUsername: null }],
  ["연결 후", { accountName: "내 계좌", linked: true, chatIdMasked: "…1234", verifiedAt: "2026-11-27T00:00:00.000Z", needsRelink: false, botUsername: "family_bot" }],
] as const) {
  test(`TelegramLinkSection: ${name}에도 연결 방법 안내 링크가 가이드로 이어진다`, async () => {
    mockStatus(status);
    render(<TelegramLinkSection />);
    const link = await screen.findByRole("link", { name: "연결 방법 안내" });
    assert.equal(link.getAttribute("href"), "/guide/telegram");
  });
}
