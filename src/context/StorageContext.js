// src/context/StorageContext.js
import { createContext } from "react";

// `provider` is "mongo" | "json" | null (unknown yet). Populated once from
// the health check the app already makes on boot, so the UI can warn when the
// backend is running on the slower JSON store.
export const StorageContext = createContext({
  provider: null,
  ready: false,
});
