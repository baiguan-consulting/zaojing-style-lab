"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";

import { localizedPath, type Locale } from "@/lib/locale";

type SessionState =
  | { loading: true }
  | { loading: false; authenticated: false }
  | { loading: false; authenticated: true; emailMasked: string };

export function AccountButton({ locale = "zh" }: { locale?: Locale }) {
  const router = useRouter();
  const english = locale === "en";
  const [session, setSession] = useState<SessionState>({ loading: true });

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.authenticated) {
          setSession({ loading: false, authenticated: false });
          return;
        }
        setSession({ loading: false, authenticated: true, emailMasked: data.user.emailMasked });
      })
      .catch(() => setSession({ loading: false, authenticated: false }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession({ loading: false, authenticated: false });
    router.push(localizedPath(locale, "/"));
    router.refresh();
  }

  if (session.loading) return <span className="account-button account-loading"><UserRound size={15} /> ···</span>;
  if (!session.authenticated) {
    return <Link className="account-button" href={localizedPath(locale, "/login")}><LogIn size={15} /> {english ? "Sign in" : "登录"}</Link>;
  }
  return (
    <span className="account-signed-in">
      <Link href={localizedPath(locale, "/credits")}><UserRound size={14} /> {session.emailMasked}</Link>
      <button type="button" onClick={logout} aria-label={english ? "Sign out" : "退出登录"}><LogOut size={14} /></button>
    </span>
  );
}
