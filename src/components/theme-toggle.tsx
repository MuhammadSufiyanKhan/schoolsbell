"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";

type Choice = "system" | "light" | "dark";
const EVENT = "theme-change";

function read(): Choice {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

function apply(choice: Choice) {
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {}
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  window.dispatchEvent(new Event(EVENT));
}

const OPTIONS: { value: Choice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** Light / device / dark. The choice is remembered in this browser only. */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as Choice);
  return (
    <div role="radiogroup" aria-label="Colour theme" className={clsx("inline-flex rounded-lg border border-border bg-surface p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
          className={clsx("grid size-7 place-items-center rounded-md transition", choice === value ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground")}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
