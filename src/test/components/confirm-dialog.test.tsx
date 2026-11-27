import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setupDom } from "@/test/dom";

let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let cleanup: typeof import("@testing-library/react").cleanup;
let act: typeof import("@testing-library/react").act;
let mod: typeof import("@/components/dashboard/confirm-dialog");
let errMod: typeof import("@/components/dashboard/inline-error");

before(async () => {
  setupDom();
  ({ render, screen, fireEvent, cleanup, act } = await import("@testing-library/react"));
  mod = await import("@/components/dashboard/confirm-dialog");
  errMod = await import("@/components/dashboard/inline-error");
});

beforeEach(() => cleanup());

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = mod.useConfirmDialog();
  return (
    <div>
      <button
        type="button"
        onClick={async () =>
          onResult(await confirm({ title: "2026-11-15 배당 기록을 삭제할까요?", body: "TIGER 미국배당 · 210,000원", confirmLabel: "기록 삭제" }))
        }
      >
        삭제
      </button>
      {dialog}
    </div>
  );
}

test("확인 대화상자: 삭제 대상을 제목·본문에 보이고, 열리면 취소에 초점, Esc 로 닫히며 false", async () => {
  const results: boolean[] = [];
  render(<Harness onResult={(ok) => results.push(ok)} />);
  const opener = screen.getByRole("button", { name: "삭제" });
  opener.focus();
  fireEvent.click(opener);

  const dialog = await screen.findByRole("alertdialog", { name: /2026-11-15 배당 기록을 삭제할까요/ });
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.match(dialog.textContent ?? "", /TIGER 미국배당 · 210,000원/);
  assert.equal(document.activeElement?.textContent, "취소");

  await act(async () => {
    fireEvent.keyDown(dialog, { key: "Escape" });
  });
  assert.equal(screen.queryByRole("alertdialog"), null);
  assert.deepEqual(results, [false]);
  assert.equal(document.activeElement, opener, "닫히면 연 버튼으로 초점 복귀");
});

test("확인 대화상자: Tab 은 대화상자 안에서만 돌고, 확인을 누르면 true", async () => {
  const results: boolean[] = [];
  render(<Harness onResult={(ok) => results.push(ok)} />);
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  const dialog = await screen.findByRole("alertdialog");
  const confirmButton = screen.getByRole("button", { name: "기록 삭제" });

  confirmButton.focus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  assert.equal(document.activeElement?.textContent, "취소", "마지막에서 Tab → 처음으로");
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  assert.equal(document.activeElement, confirmButton, "처음에서 Shift+Tab → 마지막으로");

  await act(async () => {
    fireEvent.click(confirmButton);
  });
  assert.deepEqual(results, [true]);
});

test("인라인 오류: role=alert 로 원인과 다시 시도를 보인다", () => {
  let retried = 0;
  render(<errMod.InlineError message={errMod.failureMessage("배당 기록을 삭제", new Error("서버 응답 500"))} onRetry={() => retried++} />);
  const alert = screen.getByRole("alert");
  assert.match(alert.textContent ?? "", /배당 기록을 삭제하지 못했습니다: 서버 응답 500\. 잠시 뒤 다시 시도해 주세요\./);
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  assert.equal(retried, 1);
  assert.match(errMod.failureMessage("저장", new TypeError("Failed to fetch")), /네트워크에 연결되지 않았습니다/);
});
