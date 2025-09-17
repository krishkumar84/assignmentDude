import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, Any, Tuple, List
import math

class FocusDetector:
    """Detects if candidate is focused using MediaPipe Face Detection and Pose"""
    
    def __init__(self):
        # Initialize MediaPipe
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Initialize detectors
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=0, 
            min_detection_confidence=0.5
        )
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=5,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Eye aspect ratio threshold for blink detection
        self.EAR_THRESHOLD = 0.25
        self.CONSEC_FRAMES_BLINK = 3
        
        # Head pose thresholds
        self.HEAD_POSE_THRESHOLD = 25  # degrees
        
    def detect_focus(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect focus-related metrics from a video frame
        
        Returns:
            Dict containing:
            - face_detected: bool
            - multiple_faces: bool
            - face_count: int
            - looking_at_camera: bool
            - confidence: float
            - gaze_data: dict with head pose info
            - eye_closure: bool (bonus feature)
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Face detection
        face_results = self.face_detection.process(rgb_frame)
        face_mesh_results = self.face_mesh.process(rgb_frame)
        pose_results = self.pose.process(rgb_frame)
        
        result = {
            "face_detected": False,
            "multiple_faces": False,
            "face_count": 0,
            "looking_at_camera": True,
            "confidence": 0.0,
            "gaze_data": {},
            "eye_closure": False,
            "head_pose": {}
        }
        
        # Check for faces
        if face_results.detections:
            result["face_detected"] = True
            result["face_count"] = len(face_results.detections)
            result["multiple_faces"] = len(face_results.detections) > 1
            result["confidence"] = face_results.detections[0].score[0]
        
        # Analyze face mesh for gaze direction and eye closure
        if face_mesh_results.multi_face_landmarks:
            for face_landmarks in face_mesh_results.multi_face_landmarks:
                # Head pose estimation
                head_pose = self._estimate_head_pose(face_landmarks, frame.shape)
                result["head_pose"] = head_pose
                
                # Check if looking at camera based on head pose
                if abs(head_pose["yaw"]) > self.HEAD_POSE_THRESHOLD or abs(head_pose["pitch"]) > self.HEAD_POSE_THRESHOLD:
                    result["looking_at_camera"] = False
                
                result["gaze_data"] = {
                    "head_yaw": head_pose["yaw"],
                    "head_pitch": head_pose["pitch"],
                    "head_roll": head_pose["roll"]
                }
                
                # Eye closure detection (bonus)
                eye_closure = self._detect_eye_closure(face_landmarks)
                result["eye_closure"] = eye_closure
                
                break  # Use first face only
        
        # Use pose estimation as backup for head orientation
        if pose_results.pose_landmarks and not result["face_detected"]:
            nose_landmark = pose_results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.NOSE]
            if nose_landmark.visibility > 0.5:
                # Simple pose-based detection
                result["face_detected"] = True
                result["face_count"] = 1
                result["confidence"] = nose_landmark.visibility
        
        return result
    
    def _estimate_head_pose(self, landmarks, image_shape) -> Dict[str, float]:
        """Estimate head pose from face landmarks"""
        height, width = image_shape[:2]
        
        # 3D model points (generic face model)
        model_points = np.array([
            (0.0, 0.0, 0.0),             # Nose tip
            (0.0, -330.0, -65.0),        # Chin
            (-225.0, 170.0, -135.0),     # Left eye left corner
            (225.0, 170.0, -135.0),      # Right eye right corner
            (-150.0, -150.0, -125.0),    # Left Mouth corner
            (150.0, -150.0, -125.0)      # Right mouth corner
        ])
        
        # 2D image points from landmarks
        image_points = np.array([
            (landmarks.landmark[1].x * width, landmarks.landmark[1].y * height),     # Nose tip
            (landmarks.landmark[152].x * width, landmarks.landmark[152].y * height), # Chin
            (landmarks.landmark[33].x * width, landmarks.landmark[33].y * height),   # Left eye left corner
            (landmarks.landmark[263].x * width, landmarks.landmark[263].y * height), # Right eye right corner
            (landmarks.landmark[61].x * width, landmarks.landmark[61].y * height),   # Left mouth corner
            (landmarks.landmark[291].x * width, landmarks.landmark[291].y * height)  # Right mouth corner
        ], dtype="double")
        
        # Camera internals
        focal_length = width
        center = (width/2, height/2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype="double")
        
        dist_coeffs = np.zeros((4,1))  # Assuming no lens distortion
        
        # Solve PnP
        try:
            success, rotation_vector, translation_vector = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs
            )
            
            if success:
                # Convert rotation vector to rotation matrix
                rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
                
                # Calculate Euler angles
                yaw = math.atan2(rotation_matrix[1,0], rotation_matrix[0,0]) * 180 / math.pi
                pitch = math.atan2(-rotation_matrix[2,0], 
                                 math.sqrt(rotation_matrix[2,1]**2 + rotation_matrix[2,2]**2)) * 180 / math.pi
                roll = math.atan2(rotation_matrix[2,1], rotation_matrix[2,2]) * 180 / math.pi
                
                return {"yaw": yaw, "pitch": pitch, "roll": roll}
            else:
                return {"yaw": 0, "pitch": 0, "roll": 0}
        except:
            return {"yaw": 0, "pitch": 0, "roll": 0}
    
    def _detect_eye_closure(self, landmarks) -> bool:
        """Detect eye closure using Eye Aspect Ratio"""
        
        # Eye landmark indices for MediaPipe
        LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
        RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
        
        # Calculate EAR for both eyes
        left_ear = self._calculate_ear(landmarks, LEFT_EYE_INDICES)
        right_ear = self._calculate_ear(landmarks, RIGHT_EYE_INDICES)
        
        # Average EAR
        avg_ear = (left_ear + right_ear) / 2.0
        
        return avg_ear < self.EAR_THRESHOLD
    
    def _calculate_ear(self, landmarks, eye_indices) -> float:
        """Calculate Eye Aspect Ratio for given eye landmarks"""
        try:
            # Get eye points
            eye_points = []
            for idx in eye_indices[:6]:  # Use first 6 points for basic EAR calculation
                point = landmarks.landmark[idx]
                eye_points.append([point.x, point.y])
            
            eye_points = np.array(eye_points)
            
            # Calculate distances
            A = np.linalg.norm(eye_points[1] - eye_points[5])
            B = np.linalg.norm(eye_points[2] - eye_points[4])
            C = np.linalg.norm(eye_points[0] - eye_points[3])
            
            # EAR calculation
            ear = (A + B) / (2.0 * C)
            return ear
        except:
            return 1.0  # Default to eyes open if calculation fails
    
    def draw_annotations(self, frame: np.ndarray, detection_results: Dict[str, Any]) -> np.ndarray:
        """Draw detection annotations on frame"""
        annotated_frame = frame.copy()
        
        # Draw status text
        status_text = f"Faces: {detection_results['face_count']}"
        if not detection_results['looking_at_camera']:
            status_text += " - LOOKING AWAY"
        if detection_results['eye_closure']:
            status_text += " - EYES CLOSED"
        
        cv2.putText(annotated_frame, status_text, (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0) if detection_results['looking_at_camera'] else (0, 0, 255), 2)
        
        # Draw head pose info
        if detection_results['gaze_data']:
            gaze_info = f"Yaw: {detection_results['gaze_data']['head_yaw']:.1f}, Pitch: {detection_results['gaze_data']['head_pitch']:.1f}"
            cv2.putText(annotated_frame, gaze_info, (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        return annotated_frame