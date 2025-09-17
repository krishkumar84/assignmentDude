import { ObjectId } from "mongodb";

// Define specific detail types for each event type
interface LookingAwayDetails {
  gaze_direction?: string;
  head_pose?: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  message?: string;
}

interface NoFaceDetails {
  message: string;
}

interface MultipleFacesDetails {
  face_count: number;
  message?: string;
}

interface UnauthorizedObjectDetails {
  object_type: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  message?: string;
}

// Union type for all possible details
type EventDetails = 
  | LookingAwayDetails 
  | NoFaceDetails 
  | MultipleFacesDetails 
  | UnauthorizedObjectDetails 
  | Record<string, unknown>;

export interface DetectionEvent {
  _id?: ObjectId;
  id?: string;
  sessionId: string;
  eventType:
    | "looking_away"
    | "no_face"
    | "multiple_faces"
    | "unauthorized_object";
  confidence: number;
  timestamp: Date;
  details: EventDetails;
}

export interface ProctorSession {
  _id?: ObjectId;
  id?: string;
  sessionId: string;
  candidateName: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  totalEvents: number;
  lookingAwayCount: number;
  noFaceCount: number;
  multipleFaceCount: number;
  unauthorizedObjectCount: number;
  integrityScore: number;
  status: "active" | "completed";
  events: DetectionEvent[];
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageIntegrityScore: number;
}
