import { KM } from "./km";

export type Lang = "en" | "km";
export const LANG_COOKIE = "sp_lang";

// Sentences built from data (alert details, activity reasons, box labels): matched by pattern, numbers kept.
const PATTERNS: [RegExp, string, string[]][] = [
  [/^AI scan, (\d+)% confidence$/, "AI scan, {p}% confidence", ["p"]],
  [/^AI scan at (\d\d:\d\d), (\d+)% confidence$/, "AI scan at {time}, {p}% confidence", ["time", "p"]],
  [/^Humidity ([\d.]+)%, below (\d+)% target$/, "Humidity {v}%, below {t}% target", ["v", "t"]],
  [/^Humidity reached ([\d.]+)%, upper target$/, "Humidity reached {v}%, upper target", ["v"]],
  [/^Temperature ([\d.]+) °C, above (\d+) °C\. Ventilating fresh air$/, "Temperature {v} °C, above {t} °C. Ventilating fresh air", ["v", "t"]],
  [/^([\d.]+) °C, above (\d+) °C\. Fan ventilating fresh air\.$/, "{v} °C, above {t} °C. Fan ventilating fresh air.", ["v", "t"]],
  [/^([\d.]+)% for (\d+) minutes, mister running$/, "{v}% for {m} minutes, mister running", ["v", "m"]],
  [/^No data for (\d+) minutes, back online at (\d\d:\d\d)$/, "No data for {m} minutes, back online at {time}", ["m", "time"]],
  [/^(Possible mould|Likely mould|Bag) (\d+)%$/, "{label} {p}%", ["label", "p"]],
];

/** Translate a sentence that came from data. Known patterns keep their numbers; anything else goes through translate(). */
export function translateData(lang: Lang, s: string) {
  if (lang === "en") return s;
  for (const [re, key, names] of PATTERNS) {
    const m = s.match(re);
    if (m) {
      const vars: Record<string, string> = {};
      names.forEach((n, i) => (vars[n] = n === "label" ? translate(lang, m[i + 1]) : m[i + 1]));
      return translate(lang, key, vars);
    }
  }
  return translate(lang, s);
}

/** Translate an English UI string. Missing Khmer falls back to English. `{name}` placeholders are filled from vars. */
export function translate(lang: Lang, en: string, vars?: Record<string, string | number>) {
  let s = lang === "km" ? KM[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
