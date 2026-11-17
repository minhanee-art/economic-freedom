// jsdom 전역을 세팅한다. React 컴포넌트 테스트 파일에서 가장 먼저 호출해야 한다.
import { JSDOM } from "jsdom";

export function setupDom(url = "https://pension.test"): JSDOM {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url, pretendToBeVisual: true });
  const win = dom.window;
  const global = globalThis as unknown as Record<string, unknown>;

  const assign = (key: string, value: unknown) => {
    try {
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    } catch {
      global[key] = value;
    }
  };

  assign("window", win);
  assign("document", win.document);
  assign("navigator", win.navigator);
  assign("HTMLElement", win.HTMLElement);
  assign("HTMLInputElement", win.HTMLInputElement);
  assign("HTMLSelectElement", win.HTMLSelectElement);
  assign("HTMLButtonElement", win.HTMLButtonElement);
  assign("Element", win.Element);
  assign("Node", win.Node);
  assign("Event", win.Event);
  assign("MouseEvent", win.MouseEvent);
  assign("KeyboardEvent", win.KeyboardEvent);
  assign("CustomEvent", win.CustomEvent);
  assign("MutationObserver", win.MutationObserver);
  assign("getComputedStyle", win.getComputedStyle.bind(win));
  assign("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0));
  assign("cancelAnimationFrame", (id: number) => clearTimeout(id));
  assign("self", win);
  assign("localStorage", win.localStorage);
  assign("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
  assign("scrollTo", () => {});
  assign("sessionStorage", win.sessionStorage);
  assign("IS_REACT_ACT_ENVIRONMENT", true);

  return dom;
}
