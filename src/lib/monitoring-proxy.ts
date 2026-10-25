import { ACTUATORS, MonitoringError, parseDetection, parseDeviceState, parseReceipt, record } from "./monitoring.ts";

export interface MonitoringConfig {
  baseUrl: string;
  iotKey: string;
  deviceId: string;
  cameraId: string;
}
export interface MonitoringSession { guest: boolean }

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });

// Pure handler factory: server credentials and session lookup are injected by the
// server-only adapter. Tests use an isolated transport, never the real actuator API.
export function monitoringHandlers(config: MonitoringConfig,
  session: () => Promise<MonitoringSession | null>, transport: typeof fetch = fetch) {
  async function authorized(control = false) {
    const user = await session();
    if (!user) throw new MonitoringError("unauthorized", "Sign in to monitor the grow room.", 401);
    if (control && user.guest) throw new MonitoringError("forbidden", "Sign in with a team account to control equipment.", 403);
    return user;
  }

  function baseUrl() {
    try {
      const url = new URL(config.baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
      return url.href.replace(/\/$/, "");
    } catch {
      throw new MonitoringError("configuration_missing", "The SmartPhset backend URL is not configured correctly.", 503);
    }
  }

  function device() {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.deviceId))
      throw new MonitoringError("configuration_missing", "The grow-room device is not configured correctly.", 503);
    if (!config.iotKey.trim())
      throw new MonitoringError("configuration_missing", "The server IoT key is not configured.", 503);
    return `/api/iot/devices/${encodeURIComponent(config.deviceId)}`;
  }

  async function upstream(path: string, kind: "state" | "command" | "ai", init: RequestInit = {}) {
    let response: Response;
    const url = baseUrl() + path;
    try {
      response = await transport(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
        headers: { "Accept": "application/json", ...(kind !== "ai" ? { "X-SmartPhset-IoT-Key": config.iotKey } : {}),
          ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    } catch {
      throw new MonitoringError("backend_unavailable", kind === "command"
        ? "Could not confirm command delivery. Check reported state before trying again."
        : "Cannot reach the SmartPhset backend.", 503);
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new MonitoringError("backend_authentication", "The server could not authenticate with the backend.", 502);
      if (response.status === 404)
        throw new MonitoringError(kind === "ai" ? "no_detection" : "no_state",
          kind === "ai" ? "No detection has been reported for this camera." : "No reported state, or this device is not registered with the backend.", 404);
      if (response.status === 503)
        throw new MonitoringError(kind === "command" ? "command_unavailable" : "backend_unavailable",
          kind === "command" ? "The MQTT broker or backend IoT configuration is unavailable. Command was not accepted."
            : "The backend is unavailable or its IoT key is not configured.", 503);
      if (response.status === 400) throw new MonitoringError("invalid_request", "The backend rejected the request.", 400);
      throw new MonitoringError("backend_error", "The backend could not complete the request.", 502);
    }
    if (kind === "command" && response.status !== 202)
      throw new MonitoringError("invalid_response", "Command acceptance was not confirmed. Check reported state before trying again.");
    try { return await response.json() as unknown; }
    catch { throw new MonitoringError("invalid_response", "The backend returned an unreadable response."); }
  }

  async function safely(action: () => Promise<Response>) {
    try { return await action(); }
    catch (error) {
      if (error instanceof MonitoringError) return reply({ error: error.code, message: error.message }, error.status);
      return reply({ error: "server_error", message: "The monitoring request could not be completed." }, 500);
    }
  }

  return {
    state: () => safely(async () => {
      const user = await authorized();
      const state = parseDeviceState(await upstream(device() + "/state", "state"), config.deviceId);
      return reply({ deviceId: config.deviceId, state, canControl: !user.guest,
        soil: { available: false, reason: "Sensor not installed" } });
    }),
    command: (req: Request, actuator: string) => safely(async () => {
      await authorized(true);
      // SameSite cookies plus strict Origin/content type defend browser actuation.
      if (req.headers.get("origin") !== new URL(req.url).origin)
        throw new MonitoringError("forbidden", "Commands must come from this website.", 403);
      if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
        throw new MonitoringError("invalid_request", "Send a JSON actuator command.", 400);
      if (!ACTUATORS.some(a => a === actuator)) throw new MonitoringError("invalid_request", "Unknown actuator.", 400);
      const reader = req.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 128) {
              await reader.cancel();
              throw new MonitoringError("invalid_request", "Command is too large.", 400);
            }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const text = new TextDecoder().decode(bytes);
      let body: unknown;
      try { body = JSON.parse(text); } catch { throw new MonitoringError("invalid_request", "Invalid JSON command.", 400); }
      if (!record(body) || typeof body.on !== "boolean" || Object.keys(body).length !== 1)
        throw new MonitoringError("invalid_request", "Command must contain only on: true or false.", 400);
      const receipt = parseReceipt(await upstream(device() + `/actuators/${actuator}`, "command",
        { method: "POST", body: JSON.stringify({ on: body.on }) }), body.on);
      return reply(receipt, 202);
    }),
    detection: () => safely(async () => {
      await authorized();
      if (!config.cameraId.trim() || config.cameraId.length > 100)
        throw new MonitoringError("camera_not_configured", "Set the server camera ID to view real AI results.", 503);
      const detection = parseDetection(await upstream(`/api/ai/detections/latest?camera=${encodeURIComponent(config.cameraId)}`, "ai"), config.cameraId);
      return reply({ cameraId: config.cameraId, detection });
    }),
    history: () => safely(async () => {
      await authorized();
      if (!config.cameraId.trim() || config.cameraId.length > 100)
        throw new MonitoringError("camera_not_configured", "Set the server camera ID to view real AI results.", 503);
      const value = await upstream(`/api/ai/detections?camera=${encodeURIComponent(config.cameraId)}&limit=20`, "ai");
      if (!Array.isArray(value) || value.length > 20)
        throw new MonitoringError("invalid_response", "The backend returned invalid AI history.");
      return reply({ cameraId: config.cameraId, detections: value.map(item => parseDetection(item, config.cameraId)) });
    }),
  };
}
