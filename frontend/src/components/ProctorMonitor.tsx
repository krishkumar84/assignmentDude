"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Users,
  Smartphone,
  Book,
  Clock,
  TrendingUp,
} from "lucide-react";

interface ProctorMonitorProps {
  events: DetectionEvent[];
  sessionStats: SessionStats;
  isActive: boolean;
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

interface SessionStats {
  duration: number;
  totalEvents: number;
  lookingAwayCount: number;
  noFaceCount: number;
  unauthorizedObjectCount: number;
  multipleFaceCount: number;
}

export default function ProctorMonitor({
  events,
  sessionStats,
  isActive,
}: ProctorMonitorProps) {
  const [activeTab, setActiveTab] = useState<"live" | "events" | "stats">(
    "live"
  );

  const recentEvents = events.slice(-10).reverse();

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "looking_away":
        return <EyeOff className="h-4 w-4 text-yellow-500" />;
      case "no_face":
        return <Eye className="h-4 w-4 text-red-500" />;
      case "multiple_faces":
        return <Users className="h-4 w-4 text-orange-500" />;
      case "unauthorized_object":
        return <Smartphone className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventDescription = (event: DetectionEvent) => {
    switch (event.event_type) {
      case "looking_away":
        return "Candidate looking away from camera";
      case "no_face":
        return "No face detected in frame";
      case "multiple_faces":
        return `Multiple faces detected (${event.details.face_count || 2})`;
      case "unauthorized_object":
        return `Unauthorized ${event.details.object_type || "object"} detected`;
      default:
        return event.event_type.replace("_", " ");
    }
  };

  const getSeverityColor = (eventType: string) => {
    switch (eventType) {
      case "looking_away":
        return "text-yellow-600 bg-yellow-50";
      case "no_face":
        return "text-red-600 bg-red-50";
      case "multiple_faces":
        return "text-orange-600 bg-orange-50";
      case "unauthorized_object":
        return "text-red-700 bg-red-100";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const calculateIntegrityScore = () => {
    const baseScore = 100;
    const deductions =
      sessionStats.lookingAwayCount * 2 +
      sessionStats.noFaceCount * 3 +
      sessionStats.multipleFaceCount * 10 +
      sessionStats.unauthorizedObjectCount * 15;

    return Math.max(0, baseScore - deductions);
  };

  const integrityScore = calculateIntegrityScore();

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <AlertTriangle className="h-5 w-5 text-blue-600 mr-2" />
          Proctoring Monitor
        </h3>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex">
          {[
            { id: "live", label: "Live", icon: TrendingUp },
            { id: "events", label: "Events", icon: AlertTriangle },
            { id: "stats", label: "Stats", icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "live" | "events" | "stats")}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="h-4 w-4 mr-1" />
              {tab.label}
              {tab.id === "events" && events.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {events.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === "live" && (
          <div className="space-y-4">
            {/* Status Indicator */}
            <div
              className={`p-3 rounded-lg ${
                isActive
                  ? "bg-green-50 border border-green-200"
                  : "bg-gray-50 border border-gray-200"
              }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-2 ${
                    isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <span className="font-medium">
                  {isActive ? "Session Active" : "Session Inactive"}
                </span>
              </div>
            </div>

            {/* Integrity Score */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-800">
                  Integrity Score
                </span>
                <span
                  className={`text-lg font-bold ${
                    integrityScore >= 80
                      ? "text-green-600"
                      : integrityScore >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {integrityScore}/100
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    integrityScore >= 80
                      ? "bg-green-500"
                      : integrityScore >= 60
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${integrityScore}%` }}
                />
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">
                Recent Activity
              </h4>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-gray-600 italic">
                  No violations detected
                </p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.slice(0, 3).map((event, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${getSeverityColor(
                        event.event_type
                      )}`}
                    >
                      <div className="flex items-center">
                        {getEventIcon(event.event_type)}
                        <span className="ml-2">
                          {getEventDescription(event)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">
                No events recorded
              </p>
            ) : (
              recentEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getSeverityColor(
                    event.event_type
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      {getEventIcon(event.event_type)}
                      <div className="ml-2 flex-1">
                        <p className="text-sm font-medium">
                          {getEventDescription(event)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                      {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center text-blue-600 mb-1">
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="text-xs font-medium">Duration</span>
                </div>
                <p className="text-lg font-bold text-blue-800">
                  {Math.floor(sessionStats.duration / 60)}:
                  {(sessionStats.duration % 60).toString().padStart(2, "0")}
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center text-gray-700 mb-1">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span className="text-xs font-medium">Total Events</span>
                </div>
                <p className="text-lg font-bold text-gray-800">
                  {sessionStats.totalEvents}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                <div className="flex items-center">
                  <EyeOff className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm text-gray-800">Looking Away</span>
                </div>
                <span className="font-bold text-yellow-700">
                  {sessionStats.lookingAwayCount}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                <div className="flex items-center">
                  <Eye className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-sm text-gray-800">No Face</span>
                </div>
                <span className="font-bold text-red-700">
                  {sessionStats.noFaceCount}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-orange-600 mr-2" />
                  <span className="text-sm text-gray-800">Multiple Faces</span>
                </div>
                <span className="font-bold text-orange-700">
                  {sessionStats.multipleFaceCount}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-red-100 rounded">
                <div className="flex items-center">
                  <Book className="h-4 w-4 text-red-700 mr-2" />
                  <span className="text-sm text-gray-800">Unauthorized Objects</span>
                </div>
                <span className="font-bold text-red-800">
                  {sessionStats.unauthorizedObjectCount}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
