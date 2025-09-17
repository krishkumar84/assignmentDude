"use client";

import Link from "next/link";
import { Video, Shield, FileText, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Shield className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">ProctorAI</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Advanced Video Proctoring System with AI-powered Focus Detection and
            Object Recognition
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Video className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Real-time Monitoring</h3>
            <p className="text-gray-700">
              Live video analysis with instant detection of focus loss and
              unauthorized items
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Face Detection</h3>
            <p className="text-gray-700">
              Advanced facial recognition to detect multiple faces and candidate
              absence
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <FileText className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-900">Detailed Reports</h3>
            <p className="text-gray-700">
              Comprehensive proctoring reports with integrity scores and event
              timelines
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <div className="space-x-4">
            <Link
              href="/interview"
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Video className="mr-2 h-5 w-5" />
              Start Interview Session
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center px-8 py-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FileText className="mr-2 h-5 w-5" />
              View Dashboard
            </Link>
          </div>

          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Click &quot;Start Interview Session&quot; to begin a new proctored
            interview with real-time monitoring
          </p>
        </div>

        {/* Features List */}
        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600">
                Focus Detection
              </h3>
              <ul className="space-y-2 text-gray-800">
                <li>• Real-time gaze tracking</li>
                <li>• Face absence detection (&gt;10 seconds)</li>
                <li>• Looking away alerts (&gt;5 seconds)</li>
                <li>• Multiple face detection</li>
                <li>• Eye closure monitoring (bonus)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-600">
                Object Detection
              </h3>
              <ul className="space-y-2 text-gray-800">
                <li>• Mobile phone detection</li>
                <li>• Books and notes identification</li>
                <li>• Electronic device monitoring</li>
                <li>• Real-time violation alerts</li>
                <li>• Confidence scoring</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500">
          <p>&copy; 2025 ProctorAI - Advanced Video Proctoring Solution</p>
        </div>
      </div>
    </div>
  );
}
