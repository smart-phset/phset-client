"use client";

import { LEVEL_CLASS, levelOf, pct } from "@/lib/data";
import { useTD } from "@/lib/i18n";
import type { Scan } from "@/lib/types";

/**
 * A scan photo with the AI's boxes drawn in the photo's own pixel coordinates.
 * SVG keeps boxes aligned whether the photo is shown cropped (cover) or whole (contain).
 */
export function ScanPhoto({ scan, src, fit = "cover", labels = true, className = "" }: {
  scan: Scan;
  src?: string;
  fit?: "cover" | "contain";
  labels?: boolean;
  className?: string;
}) {
  const { width: w, height: h } = scan;
  const level = levelOf(scan);
  const fs = Math.max(w, h) * 0.024;
  const td = useTD();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      className={`w-full h-full block ${className}`} role="img" aria-label="Bag photo with AI result">
      <image href={src ?? scan.file_url} x="0" y="0" width={w} height={h} preserveAspectRatio="none" />
      {scan.boxes.map((b, i) => {
        const [x1, y1, x2, y2] = b.xyxy;
        const contam = b.label.startsWith("contam");
        const color = contam ? LEVEL_CLASS[level === "red" ? "red" : "amber"].box : "#86d89b";
        const text = td(contam ? `${level === "red" ? "Likely mould" : "Possible mould"} ${pct(b.conf)}` : `Bag ${pct(b.conf)}`);
        return (
          <g key={i}>
            <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={color}
              strokeWidth={contam ? fs * 0.22 : fs * 0.1} strokeDasharray={contam ? undefined : `${fs * 0.5} ${fs * 0.3}`} rx={fs * 0.2} />
            {labels && contam && (
              <g>
                <rect x={x1} y={Math.max(0, y1 - fs * 1.6)} width={fs * (text.length * 0.56 + 1)} height={fs * 1.5} fill={color} rx={fs * 0.25} />
                <text x={x1 + fs * 0.5} y={Math.max(0, y1 - fs * 1.6) + fs * 1.08} fontSize={fs} fontWeight={700}
                  fill={level === "red" ? "#ffffff" : "#251a00"} fontFamily="Plus Jakarta Sans, sans-serif">{text}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
