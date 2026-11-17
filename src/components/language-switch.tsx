"use client";

import { Languages, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { localizedPath, type Locale } from "@/lib/locale";

export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextLocale = locale === "zh" ? "en" : "zh";
  const label = locale === "zh" ? "EN" : "中文";

  function switchLocale() {
    startTransition(async () => {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (response.ok) {
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        router.push(localizedPath(nextLocale, currentPath));
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      className="language-switch"
      onClick={switchLocale}
      disabled={pending}
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      {pending ? <LoaderCircle className="spin" /> : <Languages />}
      <span>{label}</span>
    </button>
  );
}
