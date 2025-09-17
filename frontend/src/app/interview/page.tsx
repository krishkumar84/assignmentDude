"use client";

import { useState, useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  Play,
  Square,
  AlertTriangle,
  User,
  Clock,
  Shield,
} from "lucide-react";
import VideoStream from "@/components/VideoStream";
import ProctorMonitor from "@/components/ProctorMonitor";
import SessionControls from "@/components/SessionControls";

export default function InterviewPage() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  interface DetectionEventData {
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
  
  const [events, setEvents] = useState<DetectionEventData[]>([]);
  const [sessionStats, setSessionStats] = useState({
    duration: 0,
    totalEvents: 0,
    lookingAwayCount: 0,
    noFaceCount: 0,
    unauthorizedObjectCount: 0,
    multipleFaceCount: 0,
  });

  const startSession = async (name: string) => {
    try {
      const response = await fetch("http://localhost:8000/api/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `candidate_name=${encodeURIComponent(name)}`,
      });

      const data = await response.json();

      if (data.session_id) {
        setSessionId(data.session_id);
        setCandidateName(name);
        setIsSessionActive(true);
        setSessionStartTime(new Date());
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      alert(
        "Failed to connect to proctoring server. Please ensure the backend is running."
      );
    }
  };

  // Simple function to save session data to MongoDB
  const saveSessionToMongoDB = async () => {
    try {
      // Calculate integrity score
      const baseScore = 100;
      const deductions = 
        (sessionStats.lookingAwayCount * 2) +
        (sessionStats.noFaceCount * 3) +
        (sessionStats.multipleFaceCount * 10) +
        (sessionStats.unauthorizedObjectCount * 15);
      const integrityScore = Math.max(0, baseScore - deductions);

      // Prepare session data for MongoDB
      const sessionData = {
        sessionId,
        candidateName,
        startTime: sessionStartTime,
        endTime: new Date(),
        duration: sessionStats.duration,
        totalEvents: sessionStats.totalEvents,
        lookingAwayCount: sessionStats.lookingAwayCount,
        noFaceCount: sessionStats.noFaceCount,
        multipleFaceCount: sessionStats.multipleFaceCount,
        unauthorizedObjectCount: sessionStats.unauthorizedObjectCount,
        integrityScore,
        status: "completed" as const,
        events: events.map(event => ({
          eventType: event.event_type,
          confidence: event.confidence,
          timestamp: new Date(event.timestamp),
          details: event.details,
          sessionId
        }))
      };

      // Save to MongoDB via Next.js API
      const saveResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (saveResponse.ok) {
        console.log('Session data saved to MongoDB successfully');
        return true;
      } else {
        console.error('Failed to save session data to MongoDB');
        return false;
      }
    } catch (error) {
      console.error('Error saving session data:', error);
      return false;
    }
  };

  const endSession = async () => {
    try {
      // End session on backend
      const response = await fetch(
        `http://localhost:8000/api/session/${sessionId}/end`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      // Save session data to MongoDB
      const saved = await saveSessionToMongoDB();
      
      setIsSessionActive(false);
      setIsRecording(false);

      // Show completion message and redirect to dashboard
      const message = saved 
        ? "Session completed and saved! You will be redirected to the dashboard."
        : "Session completed! Note: Data may not have been saved properly. You will be redirected to the dashboard.";
        
      alert(message);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error) {
      console.error("Failed to end session:", error);
      // Still try to save data even if backend fails
      await saveSessionToMongoDB();
      setIsSessionActive(false);
      setIsRecording(false);
    }
  };

  const handleNewEvent = (event: DetectionEventData) => {
    setEvents((prev) => [...prev, event]);

    // Update stats
    setSessionStats((prev) => ({
      ...prev,
      totalEvents: prev.totalEvents + 1,
      lookingAwayCount:
        event.event_type === "looking_away"
          ? prev.lookingAwayCount + 1
          : prev.lookingAwayCount,
      noFaceCount:
        event.event_type === "no_face"
          ? prev.noFaceCount + 1
          : prev.noFaceCount,
      unauthorizedObjectCount:
        event.event_type === "unauthorized_object"
          ? prev.unauthorizedObjectCount + 1
          : prev.unauthorizedObjectCount,
      multipleFaceCount:
        event.event_type === "multiple_faces"
          ? prev.multipleFaceCount + 1
          : prev.multipleFaceCount,
    }));
  };

  // Update session duration
  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      const interval = setInterval(() => {
        const duration = Math.floor(
          (Date.now() - sessionStartTime.getTime()) / 1000
        );
        setSessionStats((prev) => ({ ...prev, duration }));
      }, 1000);

      return () => clearInterval(interval);
    }
    
    // Return undefined if condition is not met
    return undefined;
  }, [isSessionActive, sessionStartTime]);

  if (!isSessionActive) {
    return <SessionSetup onStart={startSession} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  ProctorAI Interview
                </h1>
                <p className="text-sm text-gray-500">
                  Candidate: {candidateName}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  {Math.floor(sessionStats.duration / 60)}:
                  {(sessionStats.duration % 60).toString().padStart(2, "0")}
                </span>
              </div>

              <div
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                  isRecording
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isRecording ? "bg-red-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <span>{isRecording ? "Recording" : "Stopped"}</span>
              </div>

              <button
                onClick={endSession}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Stream */}
          <div className="lg:col-span-2">
            <VideoStream
              sessionId={sessionId}
              isRecording={isRecording}
              onEvent={handleNewEvent}
            />
          </div>

          {/* Proctoring Monitor */}
          <div className="lg:col-span-1">
            <ProctorMonitor
              events={events}
              sessionStats={sessionStats}
              isActive={isSessionActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionSetup({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!name.trim()) {
      alert("Please enter candidate name");
      return;
    }

    setIsStarting(true);
    await onStart(name.trim());
    setIsStarting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Start Interview Session
          </h1>
          <p className="text-gray-700">
            This session will be monitored using AI-powered proctoring
            technology
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Candidate Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
              placeholder="Enter your full name"
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Before you begin:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ensure good lighting on your face</li>
                  <li>Remove any unauthorized items from view</li>
                  <li>Stay focused on the camera</li>
                  <li>Avoid looking away for extended periods</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isStarting || !name.trim()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting Session...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Proctored Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
