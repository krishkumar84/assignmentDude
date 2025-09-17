import cv2
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Any
import torch

class ObjectDetector:
    """Detects unauthorized objects using YOLO"""
    
    def __init__(self):
        # Load YOLOv8 model
        self.model = YOLO('yolov8n.pt')  # nano version for speed
        
        # Define unauthorized object classes with multiple phone IDs
        self.unauthorized_classes = {
            67: 'phone',      # cell phone
            77: 'phone',      # mobile phone (alternative ID)
            84: 'book',       # book
            # Multiple phone detection IDs for better coverage
        }
        
        # Custom class names for books/papers/notes
        self.paper_classes = ['book', 'paper', 'notebook', 'document']
        
        # Confidence thresholds (lower for phones to detect more instances)
        self.confidence_threshold = 0.5  # General threshold
        self.phone_confidence_threshold = 0.3  # Lower threshold for phones
        
    def detect_objects(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect unauthorized objects in the frame
        
        Returns:
            List of detected objects with class, confidence, and bbox
        """
        detections = []
        
        try:
            # Run YOLO detection
            results = self.model(frame, verbose=False)
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get detection data
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        
                        # Get class name first
                        class_name = self._get_class_name(class_id)
                        
                        # Use different thresholds for phones vs other objects
                        threshold = self.phone_confidence_threshold if 'phone' in class_name.lower() else self.confidence_threshold
                        
                        # Check if it's an unauthorized object
                        if confidence >= threshold:
                            if self._is_unauthorized_object(class_id, class_name):
                                # Get bounding box coordinates
                                x1, y1, x2, y2 = box.xyxy[0].tolist()
                                
                                detection = {
                                    "class": class_name,
                                    "class_id": class_id,
                                    "confidence": confidence,
                                    "bbox": {
                                        "x1": int(x1),
                                        "y1": int(y1),
                                        "x2": int(x2),
                                        "y2": int(y2),
                                        "width": int(x2 - x1),
                                        "height": int(y2 - y1)
                                    }
                                }
                                
                                detections.append(detection)
            
        except Exception as e:
            print(f"Error in object detection: {e}")
        
        return detections
    
    def _get_class_name(self, class_id: int) -> str:
        """Get class name from class ID"""
        if class_id in self.unauthorized_classes:
            return self.unauthorized_classes[class_id]
        else:
            # Use YOLO's default class names
            return self.model.names.get(class_id, f"class_{class_id}")
    
    def _is_unauthorized_object(self, class_id: int, class_name: str) -> bool:
        """Check if the detected object is unauthorized"""
        # Check predefined unauthorized classes
        if class_id in self.unauthorized_classes:
            return True
        
        # Check for paper-like objects using class name
        class_name_lower = class_name.lower()
        for paper_class in self.paper_classes:
            if paper_class in class_name_lower:
                return True
        
        # Enhanced phone detection with more keywords and YOLO class IDs
        phone_keywords = ['phone', 'mobile', 'cell', 'smartphone', 'iphone', 'android']
        phone_class_ids = [67, 77, 78, 79]  # Multiple possible YOLO IDs for phones
        
        # Check by class ID
        if class_id in phone_class_ids:
            return True
            
        # Check by class name
        for keyword in phone_keywords:
            if keyword in class_name_lower:
                return True
        
        # Check YOLO's default class names that might contain phones
        yolo_name = self.model.names.get(class_id, '').lower()
        for keyword in phone_keywords:
            if keyword in yolo_name:
                return True
        
        # Exclude common false positives
        exclude_keywords = ['laptop', 'computer', 'monitor', 'screen', 'tv', 'television']
        for keyword in exclude_keywords:
            if keyword in class_name_lower:
                return False
        
        return False
    
    def detect_with_custom_model(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Enhanced detection using custom training for specific objects
        This can be extended with custom trained models for better accuracy
        """
        # For now, use standard YOLO detection
        detections = self.detect_objects(frame)
        
        # Add custom post-processing for better paper/book detection
        enhanced_detections = []
        
        for detection in detections:
            # Enhance book/paper detection using color and texture analysis
            if detection["class"] in ["book", "paper"]:
                bbox = detection["bbox"]
                roi = frame[bbox["y1"]:bbox["y2"], bbox["x1"]:bbox["x2"]]
                
                # Simple heuristics for paper-like objects
                if self._is_paper_like(roi):
                    detection["confidence"] = min(0.9, detection["confidence"] + 0.2)
                    detection["class"] = "paper/notes"
            
            enhanced_detections.append(detection)
        
        return enhanced_detections
    
    def _is_paper_like(self, roi: np.ndarray) -> bool:
        """Simple heuristic to check if ROI looks like paper"""
        if roi.size == 0:
            return False
        
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            
            # Check for rectangular shapes (paper is usually rectangular)
            edges = cv2.Canny(gray, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                # Approximate contour to polygon
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                # Check if it's roughly rectangular (4 corners)
                if len(approx) >= 4:
                    return True
            
            return False
        except:
            return False
    
    def draw_detections(self, frame: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """Draw detection bounding boxes and labels on frame"""
        annotated_frame = frame.copy()
        
        for detection in detections:
            bbox = detection["bbox"]
            class_name = detection["class"]
            confidence = detection["confidence"]
            
            # Draw bounding box
            cv2.rectangle(annotated_frame, 
                         (bbox["x1"], bbox["y1"]), 
                         (bbox["x2"], bbox["y2"]), 
                         (0, 0, 255), 2)
            
            # Draw label
            label = f"{class_name}: {confidence:.2f}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
            
            cv2.rectangle(annotated_frame,
                         (bbox["x1"], bbox["y1"] - label_size[1] - 10),
                         (bbox["x1"] + label_size[0], bbox["y1"]),
                         (0, 0, 255), -1)
            
            cv2.putText(annotated_frame, label,
                       (bbox["x1"], bbox["y1"] - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        return annotated_frame
    
    def get_detection_summary(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get summary of detections"""
        summary = {
            "total_detections": len(detections),
            "object_counts": {},
            "high_confidence_detections": 0,
            "severity_score": 0
        }
        
        for detection in detections:
            class_name = detection["class"]
            confidence = detection["confidence"]
            
            # Count objects by class
            summary["object_counts"][class_name] = summary["object_counts"].get(class_name, 0) + 1
            
            # Count high confidence detections
            if confidence > 0.8:
                summary["high_confidence_detections"] += 1
            
            # Calculate severity score (phones and laptops are more severe)
            if class_name in ["phone", "laptop", "tablet"]:
                summary["severity_score"] += confidence * 10
            elif class_name in ["book", "paper", "notebook"]:
                summary["severity_score"] += confidence * 5
            else:
                summary["severity_score"] += confidence * 3
        
        return summary