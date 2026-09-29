// src/context/useStorage.js
import { useContext } from "react";
import { StorageContext } from "./StorageContext";

export function useStorage() {
  return useContext(StorageContext);
}
