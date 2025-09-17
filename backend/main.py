from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import cv2
import mediapipe as mp
import numpy as np
import json
import asyncio
import base64
from datetime import datetime
from typing import Dict, List
import os
from models.proctoring_session import ProctorSession, DetectionEvent
from models.object_detector import ObjectDetector
from models.focus_detector import FocusDetector
from models.report_generator import ReportGenerator

app = FastAPI(title="Video Proctoring API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://assignment-dude.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detectors
focus_detector = FocusDetector()
object_detector = ObjectDetector()
report_generator = ReportGenerator()

# Store active sessions
active_sessions: Dict[str, ProctorSession] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "Video Proctoring API is running"}

@app.post("/api/session/start")
async def start_session(candidate_name: str = Form(...)):
    """Start a new proctoring session"""
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    session = ProctorSession(session_id=session_id, candidate_name=candidate_name)
    active_sessions[session_id] = session
    
    return {
        "session_id": session_id,
        "candidate_name": candidate_name,
        "start_time": session.start_time.isoformat(),
        "status": "active"
    }

@app.post("/api/session/{session_id}/end")
async def end_session(session_id: str):
    """End a proctoring session"""
    if session_id not in active_sessions:
        return {"error": "Session not found"}
    
    session = active_sessions[session_id]
    session.end_session()
    
    # Generate report
    report_data = report_generator.generate_report(session)
    
    return {
        "session_id": session_id,
        "end_time": session.end_time.isoformat(),
        "duration": session.get_duration(),
        "report": report_data,
        "status": "completed"
    }

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time video processing"""
    await manager.connect(websocket)
    
    if session_id not in active_sessions:
        await websocket.send_text(json.dumps({"error": "Session not found"}))
        return
    
    session = active_sessions[session_id]
    
    try:
        while True:
            # Receive frame data
            data = await websocket.receive_text()
            frame_data = json.loads(data)
            
            if frame_data.get("type") == "frame":
                # Decode base64 frame
                frame_base64 = frame_data["frame"]
                frame_bytes = base64.b64decode(frame_base64.split(",")[1])
                nparr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Process frame
                events = await process_frame(frame, session)
                
                # Send events back to client
                if events:
                    await websocket.send_text(json.dumps({
                        "type": "events",
                        "events": [event.to_dict() for event in events],
                        "timestamp": datetime.now().isoformat()
                    }))
                
                # Send session stats
                stats = session.get_session_stats()
                await websocket.send_text(json.dumps({
                    "type": "stats",
                    "stats": stats
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client disconnected from session {session_id}")

async def process_frame(frame: np.ndarray, session: ProctorSession) -> List[DetectionEvent]:
    """Process a single frame and detect events"""
    events = []
    current_time = datetime.now()
    
    # Focus detection
    focus_results = focus_detector.detect_focus(frame)
    
    if not focus_results["face_detected"]:
        event = DetectionEvent(
            event_type="no_face",
            confidence=1.0,
            timestamp=current_time,
            details={"message": "No face detected"}
        )
        session.add_event(event)
        events.append(event)
    
    elif focus_results["multiple_faces"]:
        event = DetectionEvent(
            event_type="multiple_faces",
            confidence=focus_results["confidence"],
            timestamp=current_time,
            details={"face_count": focus_results["face_count"]}
        )
        session.add_event(event)
        events.append(event)
    
    elif not focus_results["looking_at_camera"]:
        event = DetectionEvent(
            event_type="looking_away",
            confidence=focus_results["confidence"],
            timestamp=current_time,
            details=focus_results["gaze_data"]
        )
        session.add_event(event)
        events.append(event)
    
    # Object detection
    object_results = object_detector.detect_objects(frame)
    
    # Log detections for debugging
    if object_results:
        print(f"[DEBUG] Detected objects: {[det['class'] for det in object_results]}")
    
    for detection in object_results:
        if detection["class"] in ["phone", "book", "laptop", "tablet"]:
            print(f"[DEBUG] Phone/Object detected: {detection['class']} with confidence {detection['confidence']}")
            event = DetectionEvent(
                event_type="unauthorized_object",
                confidence=detection["confidence"],
                timestamp=current_time,
                details={
                    "object_type": detection["class"],
                    "bbox": detection["bbox"]
                }
            )
            session.add_event(event)
            events.append(event)
    
    return events

@app.get("/api/session/{session_id}/report")
async def get_session_report(session_id: str):
    """Get session report"""
    if session_id not in active_sessions:
        return {"error": "Session not found"}
    
    session = active_sessions[session_id]
    report_data = report_generator.generate_report(session)
    return report_data

@app.get("/api/session/{session_id}/report/pdf")
async def download_pdf_report(session_id: str):
    """Download PDF report"""
    if session_id not in active_sessions:
        return {"error": "Session not found"}
    
    session = active_sessions[session_id]
    pdf_path = report_generator.generate_pdf_report(session)
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"proctoring_report_{session_id}.pdf"
    )
#get api for sessions
@app.get("/api/sessions")
async def get_all_sessions():
    """Get all sessions"""
    sessions_data = []
    for session_id, session in active_sessions.items():
        sessions_data.append({
            "session_id": session_id,
            "candidate_name": session.candidate_name,
            "start_time": session.start_time.isoformat(),
            "status": "active" if session.end_time is None else "completed",
            "duration": session.get_duration(),
            "event_count": len(session.events)
        })
    
    return {"sessions": sessions_data}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)