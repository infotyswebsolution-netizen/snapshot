"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Upload, AlertCircle } from "lucide-react";

type CameraState =
  | "idle"
  | "requesting_permission"
  | "live"
  | "preview"
  | "permission_denied"
  | "error"
  | "no_camera";

interface CameraCaptureProps {
  onCapture: (base64: string, mediaType: "image/jpeg") => void;
}

async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_DIM = 1200;
      const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    img.src = dataUrl;
  });
}

async function checkImageQuality(
  base64: string
): Promise<"ok" | "too_dark" | "too_blurry"> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, 100);
      canvas.height = Math.min(img.height, 100);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let totalBrightness = 0;
      let variance = 0;
      const samples: number[] = [];

      for (let i = 0; i < data.length; i += 4) {
        const brightness =
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        totalBrightness += brightness;
        samples.push(brightness);
      }
      const avg = totalBrightness / samples.length;
      for (const s of samples) variance += (s - avg) ** 2;
      variance /= samples.length;

      if (avg < 40) {
        resolve("too_dark");
      } else if (variance < 100) {
        resolve("too_blurry");
      } else {
        resolve("ok");
      }
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const [state, setState] = useState<CameraState>("idle");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("no_camera");
      return;
    }
    setState("requesting_permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("live");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setState("permission_denied");
      } else {
        setState("error");
      }
    }
  }

  function captureFrame() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setPreviewDataUrl(dataUrl);
    stopCamera();
    setState("preview");
    setQualityWarning(null);
  }

  async function confirmCapture() {
    if (!previewDataUrl) return;
    const base64 = previewDataUrl.split(",")[1];
    const quality = await checkImageQuality(base64);
    if (quality === "too_dark") {
      setQualityWarning(
        "Photo looks too dark. Try better lighting or use the flash."
      );
      return;
    }
    if (quality === "too_blurry") {
      setQualityWarning(
        "Photo might be blurry. Hold steady and try again, or continue."
      );
      // Don't block — just warn. User can still proceed.
    }
    const compressed = await compressImage(previewDataUrl);
    onCapture(compressed, "image/jpeg");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewDataUrl(dataUrl);
      setState("preview");
      setQualityWarning(null);
    };
    reader.readAsDataURL(file);
  }

  if (state === "idle" || state === "no_camera") {
    return (
      <div className="space-y-3">
        <button
          onClick={startCamera}
          disabled={state === "no_camera"}
          className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-3 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Camera className="h-10 w-10 text-gray-300" />
          <span className="text-sm font-medium text-gray-400">
            Tap to open camera
          </span>
        </button>
        <div className="text-center">
          <span className="text-xs text-gray-400">or</span>
        </div>
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload photo from device
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        {state === "no_camera" && (
          <p className="text-xs text-center text-gray-400">
            Camera not available on this device — please upload a photo.
          </p>
        )}
      </div>
    );
  }

  if (state === "requesting_permission") {
    return (
      <div className="h-48 rounded-2xl bg-gray-900 flex items-center justify-center">
        <p className="text-white text-sm">Requesting camera access...</p>
      </div>
    );
  }

  if (state === "permission_denied") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm font-medium text-red-700">Camera access denied</p>
        <p className="text-xs text-red-500">
          Go to your browser settings → Site permissions → Camera → Allow for
          this site.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload a photo instead
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-500">Camera failed to start.</p>
        <Button variant="outline" size="sm" onClick={() => setState("idle")}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  if (state === "live") {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-4 border-2 border-white/40 rounded-xl pointer-events-none" />
          <p className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-xs">
            Frame the invoice in the box
          </p>
        </div>
        <button
          onClick={captureFrame}
          className="w-full h-20 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full border-4 border-white bg-blue-600 flex items-center justify-center">
            <Camera className="h-7 w-7 text-white" />
          </div>
        </button>
      </div>
    );
  }

  if (state === "preview" && previewDataUrl) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewDataUrl}
            alt="Captured invoice"
            className="w-full h-full object-cover"
          />
        </div>
        {qualityWarning && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
            {qualityWarning}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              setPreviewDataUrl(null);
              setState("idle");
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          <Button className="h-12" onClick={confirmCapture}>
            Use this photo
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
