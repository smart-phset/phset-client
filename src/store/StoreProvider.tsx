"use client";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { makeStore } from "./store";
import { AIAlertWatcher } from "@/features/ai-alerts/AIAlertWatcher";
import { AIToastContainer } from "@/features/ai-alerts/AIToastContainer";

export function AIStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  useEffect(() => setupListeners(store.dispatch), [store]);
  return <Provider store={store}>
    <AIAlertWatcher />
    {children}
    <AIToastContainer />
  </Provider>;
}
