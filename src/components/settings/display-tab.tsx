"use client";

// 설정 > 화면 — 테마(라이트/다크/시스템). 누르는 즉시 이 기기에 저장된다.
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/lib/theme";
import { panelClass } from "@/components/settings/settings-shared";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

export function DisplayTab() {
  const { theme, setTheme } = useTheme();
  return (
    <section aria-labelledby="settings-theme" className={panelClass}>
      <h2 id="settings-theme" className="text-base font-bold tracking-tight">테마</h2>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">시스템을 고르면 기기의 라이트·다크 설정을 따릅니다.</p>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={theme === opt.value}
            className={cn(
              "flex-1 h-11 border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              theme === opt.value
                ? "bg-brand text-white border-brand"
                : "border-hairline dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
