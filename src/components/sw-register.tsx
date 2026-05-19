"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const swReg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Check for updates every 60 s while the tab is open
        const interval = setInterval(() => {
          void swReg.update();
        }, 60_000);

        // Apply update immediately when detected
        swReg.addEventListener("updatefound", () => {
          const newWorker = swReg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — notify the page
              window.dispatchEvent(new CustomEvent("sw:update-available", { detail: { registration: swReg } }));
            }
          });
        });

        return () => {
          clearInterval(interval);
        };
      } catch (err) {
        console.warn("[SW] Registration failed:", err);
      }
    };

    void register();
  }, []);

  // Listen for the update signal; if the page re-validates, reload the tab
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("sw:update-available", reload);
    return () => window.removeEventListener("sw:update-available", reload);
  }, []);

  // Response to a "skip waiting" message from the SW
  useEffect(() => {
    const handler = () => {
      if (navigator.serviceWorker.controller) {
        void navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      }
    };
    window.addEventListener("sw:skip-waiting", handler);
    return () => window.removeEventListener("sw:skip-waiting", handler);
  }, []);

  return null;
}
