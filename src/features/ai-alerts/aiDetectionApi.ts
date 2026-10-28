import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { parseDetection, record, type Detection } from "../../lib/monitoring.ts";

export interface LatestAIDetection { cameraId: string; detection: Detection }
export const aiDetectionApi = createApi({
  reducerPath: "aiDetectionApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/ai/live/", credentials: "same-origin", cache: "no-store", timeout: 8_000 }),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: builder => ({
    getLatestAIDetection: builder.query<LatestAIDetection, string | void>({
      query: cameraId => cameraId ? `detection?camera=${encodeURIComponent(cameraId)}` : "detection",
      // Keep the displayed metadata monotonic too, not just the alert baseline.
      merge(current, incoming) {
        if (current.cameraId === incoming.cameraId &&
            (current.detection.id === incoming.detection.id ||
             Date.parse(incoming.detection.captured_at) <= Date.parse(current.detection.captured_at))) return;
        return incoming;
      },
      transformResponse(value: unknown, _meta, cameraId) {
        if (!record(value) || typeof value.cameraId !== "string" || (cameraId && value.cameraId !== cameraId)) throw new Error("Invalid camera metadata");
        return { cameraId: value.cameraId, detection: parseDetection(value.detection, value.cameraId) };
      },
    }),
  }),
});
// Dashboard views read the global watcher; a different selected camera gets its own cache entry.
export const useLatestAIDetectionState = () => aiDetectionApi.endpoints.getLatestAIDetection.useQueryState();
export const { useGetLatestAIDetectionQuery } = aiDetectionApi;

/** Reuse the global watcher when it watches this source; otherwise poll a
 * camera-keyed cache entry only while the selected shared panel is mounted. */
export function useLiveCameraDetection(cameraId?: string) {
  const global = useLatestAIDetectionState();
  const reuse = !cameraId || global.data?.cameraId === cameraId;
  const selected = useGetLatestAIDetectionQuery(cameraId, {
    skip: reuse, pollingInterval: 2000, skipPollingIfUnfocused: true,
  });
  return reuse ? global : selected;
}
