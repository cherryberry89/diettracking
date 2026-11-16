"use client";

import { useEffect, useRef, useState } from "react";

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => DetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/**
 * Live camera barcode scanner with a manual-entry fallback.
 * Uses the browser's built-in BarcodeDetector where available and the
 * ZXing library elsewhere (e.g. Safari on iPhone).
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let zxingStop: (() => void) | null = null;

    const found = (code: string) => {
      if (stopped || !/^\d{6,14}$/.test(code)) return;
      stopped = true;
      navigator.vibrate?.(60);
      onCodeRef.current(code);
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser can't use the camera here. Type the number printed under the barcode instead.");
        return;
      }
      try {
        const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (stopped) return stream.getTracks().forEach((t) => t.stop());
          video!.srcObject = stream;
          await video!.play();
          const detector = new Detector({ formats: FORMATS });
          timer = setInterval(async () => {
            if (stopped || video!.readyState < 2) return;
            try {
              const codes = await detector.detect(video!);
              if (codes[0]) found(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
          }, 250);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            video!,
            (result) => {
              if (result) found(result.getText());
            },
          );
          zxingStop = () => controls.stop();
          if (stopped) controls.stop();
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setCameraError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, or type the number under the barcode."
            : "No camera could be started. Type the number printed under the barcode instead.",
        );
      }
    }
    start();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-4">
      {cameraError ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{cameraError}</p>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="size-full object-cover" playsInline muted aria-label="Camera preview" />
          <div
            className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80"
            aria-hidden="true"
          />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/90">
            Hold the barcode inside the frame
          </p>
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\D/g, "");
          if (code) onCode(code);
        }}
      >
        <div className="flex-1">
          <label htmlFor="manual-barcode" className="label">
            Or type the barcode number
          </label>
          <input
            id="manual-barcode"
            className="input tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 3017620422003"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={manual.replace(/\D/g, "").length < 6}>
          Look up
        </button>
      </form>
    </div>
  );
}
