// src/components/JsonProviderNotice.jsx
//
// The backend can run on two storage providers. MongoDB is the default and
// the one to use in production. The JSON provider stores data in files and
// scans them on every query, so list, export and analytics operations get
// noticeably slower as a dataset grows.
//
// This notice appears only when the backend reports the JSON provider, so it
// stays quiet for the normal MongoDB case.

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useStorage } from "../context/useStorage";

export default function JsonProviderNotice() {
  const { provider, ready } = useStorage();
  const [dismissed, setDismissed] = useState(false);

  // Nothing to say until we know the provider, and nothing to say on MongoDB.
  if (!ready || provider !== "json" || dismissed) return null;

  return (
    <div className="alert alert-warning rounded-none border-x-0 border-t-0 px-4 py-2 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />

      <div className="flex-1 text-sm leading-snug">
        <span className="font-semibold">Running on the JSON storage provider.</span>{" "}
        Data is kept in files and scanned on every query, so large datasets
        will feel slower than on MongoDB. Set{" "}
        <code className="font-mono text-xs">DATA_PROVIDER=mongo</code> in{" "}
        <code className="font-mono text-xs">.env</code> and restart to switch.
      </div>

      <button
        className="btn btn-ghost btn-xs btn-circle shrink-0"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
