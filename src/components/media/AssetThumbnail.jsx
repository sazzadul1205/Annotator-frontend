// src/components/media/AssetThumbnail.jsx
// A grid thumbnail for one media asset.
//
// Media needs a token to serve its bytes, so a thumbnail cannot be a plain
// <img src="/api/..."> — it has to be fetched and turned into an object URL
// (see useAssetObjectUrl). Doing that for every cell in a 50-asset page means
// 50 concurrent video downloads, so the fetch is deferred until the cell is
// actually near the viewport.
import { useEffect, useRef, useState } from "react";
import { Film, ImageOff } from "lucide-react";
import useAssetObjectUrl from "../../hooks/useAssetObjectUrl";
import { formatDuration } from "../../lib/format";

export default function AssetThumbnail({ asset, onClick, selected }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    // A generous margin so scrolling feels instant.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const { url, loading, error } = useAssetObjectUrl(visible ? asset._id : null);
  const isVideo = asset.kind === "video";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-box border bg-base-200 transition-all hover:border-primary/50 ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-base-content/10"
      }`}
      title={asset.originalFileName}
    >
      {url ? (
        isVideo ? (
          <video
            src={url}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={url}
            alt={asset.originalFileName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {loading || !visible ? (
            <span className="loading loading-spinner loading-sm text-base-content/20" />
          ) : (
            <ImageOff className="w-6 h-6 text-base-content/20" />
          )}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-error/10">
          <ImageOff className="w-5 h-5 text-error" />
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
        <p className="text-[10px] text-white/90 truncate leading-tight">
          {asset.originalFileName}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isVideo && (
            <span className="flex items-center gap-0.5 text-[9px] text-white/80">
              <Film className="w-2.5 h-2.5" />
              {formatDuration(asset.durationMs)}
            </span>
          )}
          <span className="text-[9px] text-white/60 font-mono">
            {asset.width}×{asset.height}
          </span>
        </div>
      </div>

      {asset.annotationCount > 0 && (
        <span className="absolute top-1.5 right-1.5 badge badge-xs badge-primary font-mono">
          {asset.annotationCount}
        </span>
      )}
      {asset.status === "annotated" && asset.annotationCount > 0 && (
        <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-success ring-2 ring-white/80" />
      )}
    </button>
  );
}
