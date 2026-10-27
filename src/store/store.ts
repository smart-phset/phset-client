import { configureStore } from "@reduxjs/toolkit";
import { aiDetectionApi } from "../features/ai-alerts/aiDetectionApi";
import aiAlerts from "../features/ai-alerts/aiAlertSlice";

// One instance per mounted authenticated application; never shared across SSR requests.
export const makeStore = () => configureStore({
  reducer: { aiAlerts, [aiDetectionApi.reducerPath]: aiDetectionApi.reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(aiDetectionApi.middleware),
});
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
