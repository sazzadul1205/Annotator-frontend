// src/components/media/useVideoFrameSource.js
// Video support for the annotation canvas.
//
// The server never extracts frames. A <video> element is seeked to a timestamp
// and the browser renders that frame, so the overlay sits directly on top of
// the real decoded frame — no canvas readback, no colour conversion, and no
// second copy of the frame in memory.
//
// What the backend stores is the *position* of the frame, not the frame: a
// `timestampMs` always, and a `frameIndex` when the frame rate is known. Both
// are derived from the video's own duration, which the API returns on the
// asset.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronFirst, ChevronLast, Pause, Play, SkipBack, SkipForward } from "lucide-react";

const STEP_MS = 1000 / 30; // one frame at 30fps, the common sampling rate

/**
 * Builds the seek controls plus the props for the canvas's <video> element.
 *
 * @param {object}   props
 * @param {string}   props.url          object URL for the video blob
 * @param {number}   props.durationMs   from the asset metadata
 * @param {number}   props.timestampMs  current frame position
 * @param {Function} props.onTimestampChange  receives the new timestamp
 * @param {Function} [props.onDimensions]     receives (width, height) once the
 *                                           video reports its intrinsic size
 */
export default function useVideoFrameSource({
  url,
  durationMs,
  timestampMs,
  onTimestampChange,
  onDimensions,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  // A pending seek: the video fires `timeupdate` continuously while playing,
  // so scrubbing writes a target the element then settles on.
  const pendingRef = useRef(null);

  const total = durationMs > 0 ? durationMs : 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !ready) return undefined;
    if (pendingRef.current === null) return undefined;

    // `seeked` is the signal we want, not `timeupdate`: playing fires the
    // latter constantly and would stomp the user's scrub position.
    const apply = () => {
      if (pendingRef.current === null) return;
      const target = pendingRef.current;
      pendingRef.current = null;
      el.currentTime = target / 1000;
      onTimestampChange(target);
    };

    el.addEventListener("seeked", apply, { once: true });
    return () => el.removeEventListener("seeked", apply);
  }, [ready, onTimestampChange]);

  const seekTo = useCallback(
    (ms) => {
      const clamped = Math.max(0, Math.min(total || ms, ms));
      const el = videoRef.current;
      if (!el) {
        onTimestampChange(clamped);
        return;
      }
      if (Math.abs(el.currentTime * 1000 - clamped) < 1) {
        onTimestampChange(clamped);
        return;
      }
      pendingRef.current = clamped;
      el.currentTime = clamped / 1000;
    },
    [total, onTimestampChange],
  );

  const step = useCallback(
    (frames) => {
      const el = videoRef.current;
      const base = el ? el.currentTime * 1000 : timestampMs;
      seekTo(base + frames * STEP_MS);
    },
    [seekTo, timestampMs],
  );

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {
        /* autoplay policy — the play button will simply not take effect */
      });
    } else {
      el.pause();
    }
  }, []);

  // Keep the position in sync while playing, so a box drawn mid-playback is
  // stored against the frame the annotator was actually looking at.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    const onTimeUpdate = () => {
      if (pendingRef.current !== null) return;
      onTimestampChange(Math.round(el.currentTime * 1000));
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [onTimestampChange]);

  // Pause when the user switches to a different asset: a playing video behind
  // a new image is both noisy and a CPU burn.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.pause();
  }, [url]);

  // Props for the <video> the canvas renders. Spread onto the element rather
  // than handed over as a render prop, so the element's ref is a plain React
  // ref instead of one threaded through a callback during render.
  const mediaProps = useMemo(
    () => ({
      ref: videoRef,
      src: url,
      className: "absolute inset-0 w-full h-full",
      // The canvas owns the pointer; the native controls would fight it.
      controls: false,
      playsInline: true,
      preload: "auto",
      onLoadedMetadata: (e) => {
        setReady(true);
        onDimensions?.(e.target.videoWidth, e.target.videoHeight);
      },
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
    }),
    [url, onDimensions],
  );

  const controls = useMemo(
    () => (
      <div className="flex items-center gap-1 join bg-base-100/90 backdrop-blur border border-base-content/10 rounded-lg px-1">
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => seekTo(0)}
          title="Go to start"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => step(-1)}
          title="Previous frame"
        >
          <ChevronFirst className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={togglePlay}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => step(1)}
          title="Next frame"
        >
          <ChevronLast className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => seekTo(total)}
          title="Go to end"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    [seekTo, step, togglePlay, playing, total],
  );

  return { mediaProps, controls, videoRef, ready, seekTo, step, togglePlay };
}
