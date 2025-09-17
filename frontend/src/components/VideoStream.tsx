"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Camera, AlertCircle } from "lucide-react";

interface VideoStreamProps {
  sessionId: string;
  isRecording: boolean;
  onEvent: (event: DetectionEvent) => void;
}

interface DetectionEvent {
  event_type: string;
  confidence: number;
  timestamp: string;
  details: {
    message?: string;
    face_count?: number;
    object_type?: string;
    gaze_direction?: string;
    [key: string]: unknown;
  };
}

export default function VideoStream({
  sessionId,
  isRecording,
  onEvent,
}: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");
  const [error, setError] = useState<string | null>(null);

  // Initialize camera
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

        setStream(mediaStream);
        setCameraPermission("granted");

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
        setCameraPermission("denied");
        setError(
          "Failed to access camera. Please allow camera permissions and refresh."
        );
      }
    };

    initializeCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId || !isRecording) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "events" && data.events) {
            data.events.forEach((evt: DetectionEvent) => {
              onEvent(evt);
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setError("Connection to proctoring server lost");
        setIsConnected(false);
      };

      websocketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [sessionId, isRecording, onEvent]);

  // Send video frames to backend
  useEffect(() => {
    if (!isRecording || !isConnected || !videoRef.current || !canvasRef.current)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sendFrame = () => {
      if (
        videoRef.current &&
        websocketRef.current?.readyState === WebSocket.OPEN
      ) {
        const video = videoRef.current;

        // Set canvas size to match video
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 and send
        try {
          const dataURL = canvas.toDataURL("image/jpeg", 0.8);
          websocketRef.current.send(
            JSON.stringify({
              type: "frame",
              frame: dataURL,
              timestamp: new Date().toISOString(),
            })
          );
        } catch (err) {
          console.error("Failed to send frame:", err);
        }
      }
    };

    // Send frames at 2 FPS to reduce load
    const interval = setInterval(sendFrame, 500);

    return () => clearInterval(interval);
  }, [isRecording, isConnected]);

  if (cameraPermission === "denied") {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <VideoOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Camera Access Required
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry Camera Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Camera className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Candidate Video</span>
        </div>

        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto max-h-96"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(console.error);
            }
          }}
        />

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">LIVE</span>
          </div>
        )}

        {/* Connection status overlay */}
        {!isConnected && isRecording && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="text-gray-900">
                Connecting to proctoring server...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
