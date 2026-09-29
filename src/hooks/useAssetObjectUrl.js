// src/hooks/useAssetObjectUrl.js
// Fetches an asset's bytes and exposes them as an object URL.
//
// Media is served only through an authenticated route, so it cannot be put
// straight into <img src> or <video src> — the browser would send no
// Authorization header and get a 401. This hook fetches through the api client
// (which attaches the token) and hands back a blob: URL.
//
// The object URL is revoked on unmount and whenever the asset changes. Leaking
// one pins the whole file in memory for the life of the page, which for a video
// dataset is megabytes per asset.
import { useCallback, useEffect, useState } from "react";
import { fetchMediaAssetBlob } from "../services/mediaApi";

/**
 * @param {string|null} assetId - pass null to skip fetching
 * @returns {{ url: string|null, loading: boolean, error: string|null, reload: () => void }}
 */
export default function useAssetObjectUrl(assetId) {
  // `id` records which asset the result belongs to, so switching assets can be
  // treated as "no result yet" by derivation. Resetting state inside the effect
  // would instead cost a render and briefly expose the previous asset's URL.
  const [result, setResult] = useState({ id: null, url: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!assetId) return undefined;

    const controller = new AbortController();
    let objectUrl = null;
    let cancelled = false;

    fetchMediaAssetBlob(assetId, undefined, controller.signal)
      .then((r) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(r.data);
        setResult({ id: assetId, url: objectUrl, error: null });
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        setResult({
          id: assetId,
          url: null,
          error: err?.response?.data?.error || err.message || "Could not load media",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, nonce]);

  const fresh = result.id === assetId;
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    url: fresh ? result.url : null,
    loading: Boolean(assetId) && !fresh,
    error: fresh ? result.error : null,
    reload,
  };
}
