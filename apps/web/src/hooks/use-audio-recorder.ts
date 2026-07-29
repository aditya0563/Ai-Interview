"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is unavailable. Please ensure you are using HTTPS and a modern browser.");
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsRecording(true);
    } catch (err: unknown) {
      let msg = "Unable to access the microphone.";
      if (err instanceof DOMException) {
        msg = err.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setIsRecording(false);
  }, []);

  // Ensure all media tracks are stopped and garbage collected when the component unmounts
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return { isRecording, stream, error, startRecording, stopRecording };
}
