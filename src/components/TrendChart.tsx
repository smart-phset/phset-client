"use client";

import { useMemo } from "react";

export type Range = "6 h" | "24 h" | "7 d";

const POINTS: Record<Range, number> = { "6 h": 36, "24 h": 48, "7 d": 56 };

/** Small deterministic random generator, so a room's demo history looks the same on every render. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Demo history for one room: a smooth walk that ends exactly at the room's current reading.
 * Replaced by real readings from GET /readings when the backend is connected.
 */
export function demoSeries(roomId: string, range: Range, temp: number, rh: number, rhLow: number) {
  const n = POINTS[range];
  const r = rng(`${roomId}-${range}`);
  const tempPts: number[] = [];
  const rhPts: number[] = [];
  let tv = temp - (r() - 0.5) * 2;
  let hv = rhLow + 2 + r() * 3;
  for (let i = 0; i < n; i++) {
    tv += (r() - 0.5) * (range === "7 d" ? 0.9 : 0.45);
    hv += hv < rhLow ? 1.4 : -(0.2 + r() * 0.5); // mister kicks in below the target
    tempPts.push(tv);
    rhPts.push(Math.min(94, Math.max(80, hv)));
  }
  // bend the walk so its last point is the live reading
  const dt = temp - tempPts[n - 1];
  const dh = rh - rhPts[n - 1];
  return {
    temp: tempPts.map((v, i) => v + (dt * i) / (n - 1)),
    rh: rhPts.map((v, i) => v + (dh * i) / (n - 1)),
  };
}

const T_MIN = 24, T_MAX = 34, H_MIN = 75, H_MAX = 95;

function path(vals: number[], w: number, top: number, h: number, min: number, max: number) {
  const xs = (i: number) => (i / (vals.length - 1)) * w;
  const ys = (v: number) => top + h - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * h;
  let d = `M0,${ys(vals[0]).toFixed(1)}`;
  for (let i = 1; i < vals.length; i++) {
    const x0 = xs(i - 1), x1 = xs(i), y0 = ys(vals[i - 1]), y1 = ys(vals[i]);
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return { d, end: ys(vals[vals.length - 1]) };
}

export function TrendChart({ roomId, range, temp, rh, rhLow, rhHigh, tempMax, axes = false, bandLabel }: {
  roomId: string; range: Range; temp: number; rh: number; rhLow: number; rhHigh: number; tempMax: number; axes?: boolean; bandLabel?: string;
}) {
  const W = 700, TOP = 14, H = 200;
  const s = useMemo(() => demoSeries(roomId, range, temp, rh, rhLow), [roomId, range, temp, rh, rhLow]);
  const hy = (v: number) => TOP + H - ((v - H_MIN) / (H_MAX - H_MIN)) * H;
  const ty = (v: number) => TOP + H - ((v - T_MIN) / (T_MAX - T_MIN)) * H;
  const hp = path(s.rh, W, TOP, H, H_MIN, H_MAX);
  const tp = path(s.temp, W, TOP, H, T_MIN, T_MAX);
  const misting = s.rh.map((v, i) => (v < rhLow ? i : -1)).filter((i) => i >= 0);
  const step = W / (s.rh.length - 1);
  return (
    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${TOP + H + 6}`} role="img" aria-label="Temperature and humidity trend">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} className="text-surface-container-high" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2={W} y1={TOP + H * f} y2={TOP + H * f} />
      ))}
      <rect fill="#a1f5b5" fillOpacity="0.32" x="0" width={W} y={hy(rhHigh)} height={Math.max(2, hy(rhLow) - hy(rhHigh))} />
      {bandLabel && <text className="font-label-sm text-[10px] fill-on-tertiary-fixed-variant font-bold uppercase" x="8" y={hy(rhHigh) + 12}>{bandLabel}</text>}
      <line stroke="#ffca42" strokeDasharray="3 3" strokeWidth="1" x1="0" x2={W} y1={ty(tempMax)} y2={ty(tempMax)} />
      {misting.map((i) => (
        <rect key={i} className="text-surface-container-high" fill="currentColor" opacity="0.5" rx="2" width={Math.max(3, step * 0.8)} x={i * step - step * 0.4} y={TOP} height={H} />
      ))}
      <path d={hp.d} fill="none" stroke="#005c2e" strokeLinecap="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <path d={tp.d} fill="none" stroke="#004aad" strokeLinecap="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={hp.end} fill="#005c2e" r="4.5" />
      <circle cx={W} cy={tp.end} fill="#004aad" r="4.5" />
      {axes && (
        <g className="font-label-sm text-[10px] fill-on-surface-variant">
          <text x="-6" y={TOP + 4} textAnchor="end">{T_MAX}°C</text>
          <text x="-6" y={TOP + H / 2 + 4} textAnchor="end">{(T_MIN + T_MAX) / 2}°C</text>
          <text x="-6" y={TOP + H} textAnchor="end">{T_MIN}°C</text>
          <text x={W + 6} y={TOP + 4}>{H_MAX}%</text>
          <text x={W + 6} y={TOP + H / 2 + 4}>{(H_MIN + H_MAX) / 2}%</text>
          <text x={W + 6} y={TOP + H}>{H_MIN}%</text>
        </g>
      )}
    </svg>
  );
}
