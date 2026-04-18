import { useEffect, useRef, useState } from "react";
import { AlertCircle, Mic, ShieldCheck, Video } from "lucide-react";

type PermissionStatus = "idle" | "requesting" | "granted" | "denied";

interface InterviewPermissionGateProps {
  domain: string;
  onBack: () => void;
  onEnter: () => void;
  isStarting: boolean;
}

export function InterviewPermissionGate({
  domain,
  onBack,
  onEnter,
  isStarting,
}: InterviewPermissionGateProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>("idle");
  const [micStatus, setMicStatus] = useState<PermissionStatus>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop());
      setPreviewStream(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewStream]);

  useEffect(() => {
    if (!videoRef.current || !previewStream) return;
    videoRef.current.srcObject = previewStream;
  }, [previewStream]);

  const requestPermissions = async () => {
    setPermissionError(null);
    setCameraStatus("requesting");
    setMicStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setPreviewStream(stream);
      setCameraStatus("granted");
      setMicStatus("granted");
    } catch (err: any) {
      setCameraStatus("denied");
      setMicStatus("denied");

      if (err?.name === "NotAllowedError") {
        setPermissionError(
          "Camera and microphone access was blocked. Please allow both permissions and try again.",
        );
      } else if (err?.name === "NotFoundError") {
        setPermissionError(
          "Camera or microphone device was not found. Please connect devices and retry.",
        );
      } else {
        setPermissionError(
          "Unable to access camera/microphone. Please check browser permissions and retry.",
        );
      }
    }
  };

  const canEnter = cameraStatus === "granted" && micStatus === "granted";
  const statusTone = (status: PermissionStatus) => {
    if (status === "granted") {
      return "text-[var(--c-success)] bg-[var(--c-success-dim)] border border-[var(--c-success)]/20";
    }
    if (status === "denied") {
      return "text-[var(--c-error)] bg-[var(--c-error-dim)] border border-[var(--c-error)]/20";
    }
    if (status === "requesting") {
      return "text-[var(--c-accent)] bg-[var(--c-accent-dim)] border border-[var(--c-accent)]/20";
    }
    return "text-[var(--c-text-mute)] bg-[var(--c-surface-2)] border border-[var(--c-border)]";
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)]/95 shadow-[0_10px_40px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-8 md:py-7 border-b border-[var(--c-border)] bg-gradient-to-r from-[var(--c-surface-2)] to-[var(--c-surface)]">
          <div className="absolute -top-20 -right-10 w-56 h-56 rounded-full bg-[var(--c-accent)]/10 blur-3xl" />
          <p className="relative text-[11px] font-black uppercase tracking-[0.2em] text-[var(--c-accent)]">
            Pre-Interview Setup
          </p>
          <h1 className="relative mt-2 text-[28px] md:text-[34px] font-black tracking-tight text-[var(--c-text)]">
            Ready Check
          </h1>
          <p className="relative text-[13px] md:text-[14px] text-[var(--c-text-dim)] mt-2 max-w-[700px] leading-relaxed">
            Allow camera and microphone access before joining your {domain}{" "}
            interview. This helps us verify your environment before the session
            starts.
          </p>
        </div>

        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
              <div className="aspect-video bg-[var(--c-surface-2)] relative flex items-center justify-center">
                {previewStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[var(--c-text-mute)]">
                    <Video size={34} />
                    <span className="text-[13px] font-semibold">
                      Camera preview appears here
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[var(--c-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[12px] text-[var(--c-text-dim)] font-medium">
                  Keep this tab active and your camera centered during the
                  interview.
                </div>
                <button
                  type="button"
                  onClick={requestPermissions}
                  disabled={
                    cameraStatus === "requesting" || micStatus === "requesting"
                  }
                  className="px-4 py-2 rounded-xl text-[13px] font-bold bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {cameraStatus === "requesting" || micStatus === "requesting"
                    ? "Requesting..."
                    : "Allow Camera and Mic"}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
              <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--c-text-mute)] mb-4">
                Permission Status
              </h2>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)]">
                  <div className="flex items-center gap-2 text-[var(--c-text)] font-semibold text-[13px]">
                    <Video size={16} /> Camera
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusTone(cameraStatus)}`}
                  >
                    {cameraStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)]">
                  <div className="flex items-center gap-2 text-[var(--c-text)] font-semibold text-[13px]">
                    <Mic size={16} /> Microphone
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusTone(micStatus)}`}
                  >
                    {micStatus}
                  </span>
                </div>
              </div>

              {permissionError && (
                <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-[12px] text-red-300 flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5" />
                  <span>{permissionError}</span>
                </div>
              )}

              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-3 mb-4 text-[12px] text-[var(--c-text-dim)] flex items-start gap-2 leading-relaxed">
                <ShieldCheck
                  size={14}
                  className="mt-0.5 text-[var(--c-accent)]"
                />
                <span>
                  Interview starts only after both permissions are granted. Do
                  not close this screen until you enter.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    onBack();
                  }}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canEnter || isStarting}
                  onClick={() => {
                    stopPreview();
                    onEnter();
                  }}
                  className="flex-1 px-4 py-2 rounded-xl text-[13px] font-bold bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isStarting ? "Entering..." : "Enter Interview"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
