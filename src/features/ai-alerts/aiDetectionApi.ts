import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { parseDetection, record, type Detection } from "../../lib/monitoring.ts";

export interface LatestAIDetection { cameraId: string; detection: Detection }
export const aiDetectionApi = createApi({
  reducerPath: "aiDetectionApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/ai/live/", credentials: "same-origin", cache: "no-store", timeout: 8_000 }),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: builder => ({
    getLatestAIDetection: builder.query<LatestAIDetection, void>({
      query: () => "detection",
      // Keep the displayed metadata monotonic too, not just the alert baseline.
      merge(current, incoming) {
        if (current.cameraId === incoming.cameraId &&
            (current.detection.id === incoming.detection.id ||
             Date.parse(incoming.detection.captured_at) <= Date.parse(current.detection.captured_at))) return;
        return incoming;
      },
      transformResponse(value: unknown) {
        if (!record(value) || typeof value.cameraId !== "string") throw new Error("Invalid camera metadata");
        return { cameraId: value.cameraId, detection: parseDetection(value.detection, value.cameraId) };
      },
    }),
  }),
});
// Views only read query state. The global watcher is the sole polling subscriber.
export const useLatestAIDetectionState = () => aiDetectionApi.endpoints.getLatestAIDetection.useQueryState();
export const { useGetLatestAIDetectionQuery } = aiDetectionApi;
