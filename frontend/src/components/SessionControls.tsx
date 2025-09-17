"use client";

import { Play, Square, Download, RotateCcw } from "lucide-react";

interface SessionControlsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDownloadReport: () => void;
  onResetSession: () => void;
  disabled?: boolean;
}

export default function SessionControls({
  isRecording,
  onStartRecording,
  onStopRecording,
  onDownloadReport,
  onResetSession,
  disabled = false,
}: SessionControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Session Controls</h3>

      <div className="space-y-3">
        {/* Recording Controls */}
        <div className="flex space-x-2">
          {!isRecording ? (
            <button
              onClick={onStartRecording}
              disabled={disabled}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={onStopRecording}
              disabled={disabled}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </button>
          )}
        </div>

        {/* Report Controls */}
        <button
          onClick={onDownloadReport}
          disabled={disabled}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </button>

        {/* Reset Session */}
        <button
          onClick={onResetSession}
          disabled={disabled}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Session
        </button>
      </div>
    </div>
  );
}
