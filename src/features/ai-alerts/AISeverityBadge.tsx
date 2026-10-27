import type { AISeverity } from "./aiAlertTransitions";
export const severityStyles = {
  GREEN: "bg-tertiary-fixed text-tertiary",
  AMBER: "bg-secondary-fixed text-on-secondary-fixed",
  RED: "bg-error-container text-on-error-container",
  GREY: "bg-surface-variant text-on-surface-variant",
};
export function AISeverityBadge({ severity }: { severity: AISeverity }) {
  const label = { GREEN: "GREEN", AMBER: "YELLOW", RED: "RED", GREY: "UNKNOWN" }[severity];
  return <span className={`inline-flex rounded-full px-3 py-1 text-label-md font-bold ${severityStyles[severity]}`} aria-label={`Current AI severity: ${label}`}>{label}</span>;
}
