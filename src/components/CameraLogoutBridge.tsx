"use client";
import { useEffect } from "react";

/** Notify camera tabs even when sign-out comes from a page without a preview. */
export function CameraLogoutBridge() {
  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && new URL(form.action).pathname === "/api/auth/signout" && typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("smartphset-camera-logout");
        channel.postMessage("logout"); channel.close();
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
