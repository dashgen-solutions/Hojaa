"use client";

import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
  getAudioFile: () => File | null;
}

/**
 * Custom hook for audio recording using MediaRecorder API.
 * Provides simple interface for recording audio in the browser.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Check if browser supports MediaRecorder
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio recording. Please use Chrome, Firefox, or Edge.");
      }

      // Check if MediaRecorder is available
      if (typeof MediaRecorder === 'undefined') {
        throw new Error("MediaRecorder API is not supported in your browser.");
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      // Check if stream has audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks found in stream.");
      }

      streamRef.current = stream;

      // Determine best MIME type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length === 0) {
          setError("No audio was captured. Please try again.");
          setIsProcessing(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        
        if (audioBlob.size === 0) {
          setError("Recorded audio is empty. Please try again.");
          setIsProcessing(false);
          return;
        }

        setAudioBlob(audioBlob);
        setIsProcessing(false);

        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event: any) => {
        setError("Recording error occurred: " + (event.error?.message || "Unknown error"));
        setIsRecording(false);
        setIsProcessing(false);
      };

      // Start recording
      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      
    } catch (err: any) {
      let errorMessage = "Failed to start recording. Please try again.";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "Microphone access denied. Please allow microphone access in your browser settings and try again.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "No microphone found. Please connect a microphone and try again.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "Microphone is being used by another application. Please close other apps using the microphone.";
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "Microphone doesn't support required settings. Please try a different microphone.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsRecording(false);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      setIsRecording(false);
      
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else {
        setIsProcessing(false);
      }
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop stream if active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear state
    setAudioBlob(null);
    audioChunksRef.current = [];
    setError(null);
    setIsProcessing(false);
  }, [isRecording]);

  const getAudioFile = useCallback((): File | null => {
    if (!audioBlob || audioBlob.size === 0) {
      return null;
    }

    // Determine file extension based on blob type
    let extension = "webm";
    if (audioBlob.type.includes("mp4")) {
      extension = "mp4";
    } else if (audioBlob.type.includes("ogg")) {
      extension = "ogg";
    }

    return new File([audioBlob], `recording.${extension}`, {
      type: audioBlob.type || "audio/webm",
    });
  }, [audioBlob]);

  return {
    isRecording,
    isProcessing,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording,
    getAudioFile,
  };
}
