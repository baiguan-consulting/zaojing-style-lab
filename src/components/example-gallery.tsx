"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import type { ExamplePair } from "@/lib/template-types";
import type { Locale } from "@/lib/locale";

export function ExampleGallery({ examples, name, locale }: { examples: ExamplePair[]; name: string; locale: Locale }) {
  const english = locale === "en";
  const [active, setActive] = useState(0);
  const current = examples[active];

  function move(direction: number) {
    setActive((value) => (value + direction + examples.length) % examples.length);
  }

  if (!current) return null;

  return (
    <div className="example-gallery">
      <div className="comparison-stage">
        <figure>
          <span className="image-label">{english ? "BEFORE" : "BEFORE · 原图"}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.inputImage} alt={english ? `${name} original` : `${name}案例原图`} />
        </figure>
        <figure>
          <span className="image-label result">{english ? "AFTER" : "AFTER · 效果"}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.outputImage} alt={english ? `${name} result` : `${name}生成效果`} />
        </figure>
      </div>
      {examples.length > 1 && (
        <div className="gallery-controls">
          <span>{String(active + 1).padStart(2, "0")} / {String(examples.length).padStart(2, "0")}</span>
          <div>
            <button type="button" onClick={() => move(-1)} aria-label={english ? "Previous example" : "上一个案例"}><ArrowLeft /></button>
            <button type="button" onClick={() => move(1)} aria-label={english ? "Next example" : "下一个案例"}><ArrowRight /></button>
          </div>
        </div>
      )}
    </div>
  );
}
