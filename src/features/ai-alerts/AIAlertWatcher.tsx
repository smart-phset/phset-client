"use client";
import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { useGetLatestAIDetectionQuery } from "./aiDetectionApi";
import { detectionObserved } from "./aiAlertSlice";

export function AIAlertWatcher() {
  const dispatch = useAppDispatch();
  const { data, isError, fulfilledTimeStamp } = useGetLatestAIDetectionQuery(undefined, {
    pollingInterval: 2000, skipPollingIfUnfocused: true,
  });
  useEffect(() => {
    if (data && !isError) dispatch(detectionObserved({ detection: data.detection, observedAt: Date.now() }));
  }, [data, isError, fulfilledTimeStamp, dispatch]);
  return null;
}
