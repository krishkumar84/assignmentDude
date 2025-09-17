from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import json

@dataclass
class DetectionEvent:
    """Represents a single detection event during proctoring"""
    event_type: str  # 'looking_away', 'no_face', 'multiple_faces', 'unauthorized_object'
    confidence: float
    timestamp: datetime
    details: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "event_type": self.event_type,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details
        }

class ProctorSession:
    """Manages a single proctoring session"""
    
    def __init__(self, session_id: str, candidate_name: str):
        self.session_id = session_id
        self.candidate_name = candidate_name
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
        self.events: List[DetectionEvent] = []
        
        # Tracking variables
        self.total_looking_away_time = 0
        self.total_no_face_time = 0
        self.face_absent_start = None
        self.looking_away_start = None
        self.consecutive_frames_no_face = 0
        self.consecutive_frames_looking_away = 0
        
    def add_event(self, event: DetectionEvent):
        """Add a detection event to the session"""
        self.events.append(event)
        self._update_tracking_metrics(event)
        
    def _update_tracking_metrics(self, event: DetectionEvent):
        """Update session tracking metrics based on events"""
        current_time = datetime.now()
        
        if event.event_type == "no_face":
            self.consecutive_frames_no_face += 1
            if self.face_absent_start is None:
                self.face_absent_start = current_time
        else:
            if self.face_absent_start is not None:
                self.total_no_face_time += (current_time - self.face_absent_start).total_seconds()
                self.face_absent_start = None
            self.consecutive_frames_no_face = 0
            
        if event.event_type == "looking_away":
            self.consecutive_frames_looking_away += 1
            if self.looking_away_start is None:
                self.looking_away_start = current_time
        else:
            if self.looking_away_start is not None:
                self.total_looking_away_time += (current_time - self.looking_away_start).total_seconds()
                self.looking_away_start = None
            self.consecutive_frames_looking_away = 0
    
    def end_session(self):
        """End the proctoring session"""
        self.end_time = datetime.now()
        
        # Finalize any ongoing tracking
        if self.face_absent_start is not None:
            self.total_no_face_time += (self.end_time - self.face_absent_start).total_seconds()
            
        if self.looking_away_start is not None:
            self.total_looking_away_time += (self.end_time - self.looking_away_start).total_seconds()
    
    def get_duration(self) -> float:
        """Get session duration in seconds"""
        end_time = self.end_time or datetime.now()
        return (end_time - self.start_time).total_seconds()
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get current session statistics"""
        event_counts = {}
        for event in self.events:
            event_type = event.event_type
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        
        duration = self.get_duration()
        
        return {
            "session_id": self.session_id,
            "candidate_name": self.candidate_name,
            "duration": duration,
            "total_events": len(self.events),
            "event_counts": event_counts,
            "looking_away_time": self.total_looking_away_time,
            "no_face_time": self.total_no_face_time,
            "consecutive_no_face_frames": self.consecutive_frames_no_face,
            "consecutive_looking_away_frames": self.consecutive_frames_looking_away,
            "integrity_issues": {
                "looking_away_violations": self.total_looking_away_time > 5,  # >5 seconds
                "face_absent_violations": self.total_no_face_time > 10,  # >10 seconds
                "multiple_faces": event_counts.get("multiple_faces", 0) > 0,
                "unauthorized_objects": event_counts.get("unauthorized_object", 0) > 0
            }
        }
    
    def calculate_integrity_score(self) -> float:
        """Calculate integrity score (0-100)"""
        base_score = 100.0
        
        # Deductions
        event_counts = {}
        for event in self.events:
            event_type = event.event_type
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        
        # Looking away deductions (1 point per 5 seconds)
        looking_away_deduction = min(30, (self.total_looking_away_time / 5) * 1)
        
        # Face absent deductions (2 points per 10 seconds)
        face_absent_deduction = min(20, (self.total_no_face_time / 10) * 2)
        
        # Multiple faces deduction (5 points per occurrence)
        multiple_faces_deduction = min(20, event_counts.get("multiple_faces", 0) * 5)
        
        # Unauthorized objects deduction (10 points per occurrence)
        unauthorized_objects_deduction = min(30, event_counts.get("unauthorized_object", 0) * 10)
        
        total_deduction = (looking_away_deduction + face_absent_deduction + 
                          multiple_faces_deduction + unauthorized_objects_deduction)
        
        return max(0, base_score - total_deduction)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dictionary for JSON serialization"""
        return {
            "session_id": self.session_id,
            "candidate_name": self.candidate_name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration": self.get_duration(),
            "events": [event.to_dict() for event in self.events],
            "stats": self.get_session_stats(),
            "integrity_score": self.calculate_integrity_score()
        }