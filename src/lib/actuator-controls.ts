import { CONFIRM_MS, type CommandStatus, type Freshness } from "./monitoring.ts";

export function commandIsPending(command?: CommandStatus): boolean {
  return command?.phase === "sending" || command?.phase === "accepted";
}

// Derived presentation/availability only. The ESP32 report is the sole ON/OFF state.
export function actuatorControl(value: boolean | null | undefined, health: Freshness,
  canControl: boolean, command?: CommandStatus) {
  const reported = health === "active" && typeof value === "boolean" ? value : null;
  const pending = commandIsPending(command);
  const reason = !canControl ? "Guest access is read-only. Sign in with a team account to control equipment."
    : health !== "active" ? "Controls are unavailable until a fresh ESP32 state report is received."
    : reported === null ? "The ESP32 has not reported a valid state for this device." : null;
  return { reported, pending, reason, disabled: reported === null || !canControl || pending };
}

export function expireActuatorCommand(command: CommandStatus, now: number): CommandStatus {
  if (command.phase !== "accepted" || now - command.pending.sentAt < CONFIRM_MS) return command;
  return { ...command, phase: "unconfirmed",
    message: "No matching ESP32 report arrived in time. Check the latest reported state, then retry when available." };
}
