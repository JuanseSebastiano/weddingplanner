"use client";

import { useEffect } from "react";

/** Registra el service worker (solo en producción: en dev confunde el hot reload). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
