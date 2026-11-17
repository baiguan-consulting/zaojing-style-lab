import type { Metadata } from "next";
import { DM_Sans, Noto_Serif_SC } from "next/font/google";

import { getLocale } from "@/lib/locale-server";
import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const editorial = Noto_Serif_SC({
  variable: "--font-editorial",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "en"
    ? {
        metadataBase: getSiteUrl(),
        title: "Zaojing Style Lab · Choose a style, create your image",
        description: "Choose a curated visual style, upload an image or describe your scene, and create in one step.",
      }
    : {
        metadataBase: getSiteUrl(),
        title: "造境 Style Lab · 选择风格，生成你的图片",
        description: "选择已经调好的图片风格模板，上传图片或描述画面，一键生成同款效果。",
      };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className={`${sans.variable} ${editorial.variable}`}>
      <body>{children}</body>
    </html>
  );
}
