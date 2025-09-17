from datetime import datetime
from typing import Dict, Any, List
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import pandas as pd

class ReportGenerator:
    """Generates proctoring reports in various formats"""
    
    def __init__(self):
        self.reports_dir = "reports"
        os.makedirs(self.reports_dir, exist_ok=True)
        
    def generate_report(self, session) -> Dict[str, Any]:
        """Generate comprehensive session report"""
        stats = session.get_session_stats()
        integrity_score = session.calculate_integrity_score()
        
        # Analyze events
        event_analysis = self._analyze_events(session.events)
        timeline = self._generate_timeline(session.events)
        
        report = {
            "session_info": {
                "session_id": session.session_id,
                "candidate_name": session.candidate_name,
                "start_time": session.start_time.isoformat(),
                "end_time": session.end_time.isoformat() if session.end_time else None,
                "duration_minutes": round(session.get_duration() / 60, 2),
                "status": "completed" if session.end_time else "active"
            },
            "integrity_score": integrity_score,
            "integrity_grade": self._get_integrity_grade(integrity_score),
            "statistics": stats,
            "event_analysis": event_analysis,
            "timeline": timeline,
            "recommendations": self._generate_recommendations(stats, integrity_score),
            "generated_at": datetime.now().isoformat()
        }
        
        return report
    
    def _analyze_events(self, events: List) -> Dict[str, Any]:
        """Analyze events for patterns and insights"""
        analysis = {
            "total_events": len(events),
            "event_types": {},
            "time_distribution": {},
            "severity_breakdown": {
                "low": 0,
                "medium": 0,
                "high": 0,
                "critical": 0
            },
            "patterns": []
        }
        
        for event in events:
            event_type = event.event_type
            confidence = event.confidence
            
            # Count event types
            analysis["event_types"][event_type] = analysis["event_types"].get(event_type, 0) + 1
            
            # Analyze severity
            severity = self._get_event_severity(event_type, confidence)
            analysis["severity_breakdown"][severity] += 1
            
            # Time distribution (by hour)
            hour = event.timestamp.hour
            analysis["time_distribution"][hour] = analysis["time_distribution"].get(hour, 0) + 1
        
        # Detect patterns
        analysis["patterns"] = self._detect_patterns(events)
        
        return analysis
    
    def _get_event_severity(self, event_type: str, confidence: float) -> str:
        """Determine event severity"""
        severity_map = {
            "looking_away": "low" if confidence < 0.7 else "medium",
            "no_face": "medium" if confidence < 0.8 else "high",
            "multiple_faces": "high",
            "unauthorized_object": "critical"
        }
        
        return severity_map.get(event_type, "low")
    
    def _detect_patterns(self, events: List) -> List[str]:
        """Detect concerning patterns in events"""
        patterns = []
        
        if len(events) == 0:
            return patterns
        
        # Check for consecutive violations
        consecutive_looking_away = 0
        consecutive_no_face = 0
        
        for event in events:
            if event.event_type == "looking_away":
                consecutive_looking_away += 1
                consecutive_no_face = 0
            elif event.event_type == "no_face":
                consecutive_no_face += 1
                consecutive_looking_away = 0
            else:
                consecutive_looking_away = 0
                consecutive_no_face = 0
            
            if consecutive_looking_away > 5:
                patterns.append("Extended period of looking away detected")
                consecutive_looking_away = 0
            
            if consecutive_no_face > 3:
                patterns.append("Extended absence from camera detected")
                consecutive_no_face = 0
        
        # Check for multiple faces
        multiple_faces_count = sum(1 for event in events if event.event_type == "multiple_faces")
        if multiple_faces_count > 0:
            patterns.append(f"Multiple people detected {multiple_faces_count} times")
        
        # Check for unauthorized objects
        object_detections = [event for event in events if event.event_type == "unauthorized_object"]
        if object_detections:
            object_types = set(event.details.get("object_type", "unknown") for event in object_detections)
            patterns.append(f"Unauthorized objects detected: {', '.join(object_types)}")
        
        return patterns
    
    def _generate_timeline(self, events: List) -> List[Dict[str, Any]]:
        """Generate chronological timeline of events"""
        timeline = []
        
        for event in events:
            timeline_event = {
                "timestamp": event.timestamp.isoformat(),
                "time_formatted": event.timestamp.strftime("%H:%M:%S"),
                "event_type": event.event_type,
                "severity": self._get_event_severity(event.event_type, event.confidence),
                "confidence": round(event.confidence, 2),
                "description": self._get_event_description(event),
                "details": event.details
            }
            timeline.append(timeline_event)
        
        return sorted(timeline, key=lambda x: x["timestamp"])
    
    def _get_event_description(self, event) -> str:
        """Get human-readable event description"""
        descriptions = {
            "looking_away": "Candidate looking away from camera",
            "no_face": "No face detected in frame",
            "multiple_faces": "Multiple faces detected",
            "unauthorized_object": f"Unauthorized object detected: {event.details.get('object_type', 'unknown')}"
        }
        
        return descriptions.get(event.event_type, f"Event: {event.event_type}")
    
    def _get_integrity_grade(self, score: float) -> str:
        """Convert integrity score to grade"""
        if score >= 90:
            return "A (Excellent)"
        elif score >= 80:
            return "B (Good)"
        elif score >= 70:
            return "C (Satisfactory)"
        elif score >= 60:
            return "D (Poor)"
        else:
            return "F (Fail)"
    
    def _generate_recommendations(self, stats: Dict[str, Any], integrity_score: float) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        
        if integrity_score < 70:
            recommendations.append("Consider re-examination due to low integrity score")
        
        if stats["looking_away_time"] > 30:
            recommendations.append("Candidate showed significant inattention - review session recording")
        
        if stats["no_face_time"] > 60:
            recommendations.append("Extended periods without face detection - technical issues or candidate absence")
        
        if stats["event_counts"].get("multiple_faces", 0) > 0:
            recommendations.append("Multiple people detected - investigate for assistance or cheating")
        
        if stats["event_counts"].get("unauthorized_object", 0) > 0:
            recommendations.append("Unauthorized objects detected - review for academic dishonesty")
        
        if not recommendations:
            recommendations.append("Session completed with good integrity - no major concerns")
        
        return recommendations
    
    def generate_pdf_report(self, session) -> str:
        """Generate PDF report"""
        report_data = self.generate_report(session)
        filename = f"{self.reports_dir}/proctoring_report_{session.session_id}.pdf"
        
        doc = SimpleDocTemplate(filename, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        story.append(Paragraph("Proctoring Session Report", title_style))
        story.append(Spacer(1, 12))
        
        # Session Info
        story.append(Paragraph("Session Information", styles['Heading2']))
        session_info = report_data["session_info"]
        
        session_data = [
            ["Candidate Name", session_info["candidate_name"]],
            ["Session ID", session_info["session_id"]],
            ["Duration", f"{session_info['duration_minutes']} minutes"],
            ["Start Time", session_info["start_time"]],
            ["End Time", session_info["end_time"] or "N/A"],
            ["Status", session_info["status"]]
        ]
        
        session_table = Table(session_data, colWidths=[2*inch, 3*inch])
        session_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(session_table)
        story.append(Spacer(1, 12))
        
        # Integrity Score
        story.append(Paragraph("Integrity Assessment", styles['Heading2']))
        score = report_data["integrity_score"]
        grade = report_data["integrity_grade"]
        
        score_color = colors.green if score >= 80 else colors.orange if score >= 60 else colors.red
        
        integrity_data = [
            ["Integrity Score", f"{score:.1f}/100"],
            ["Grade", grade],
            ["Status", "PASS" if score >= 60 else "FAIL"]
        ]
        
        integrity_table = Table(integrity_data, colWidths=[2*inch, 3*inch])
        integrity_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(integrity_table)
        story.append(Spacer(1, 12))
        
        # Event Summary
        story.append(Paragraph("Event Summary", styles['Heading2']))
        event_analysis = report_data["event_analysis"]
        
        event_data = [["Event Type", "Count", "Severity"]]
        for event_type, count in event_analysis["event_types"].items():
            severity = "High" if event_type in ["multiple_faces", "unauthorized_object"] else "Medium"
            event_data.append([event_type.replace("_", " ").title(), str(count), severity])
        
        if len(event_data) > 1:
            event_table = Table(event_data, colWidths=[2*inch, 1*inch, 1*inch])
            event_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(event_table)
        else:
            story.append(Paragraph("No events detected during session.", styles['Normal']))
        
        story.append(Spacer(1, 12))
        
        # Recommendations
        story.append(Paragraph("Recommendations", styles['Heading2']))
        for i, recommendation in enumerate(report_data["recommendations"], 1):
            story.append(Paragraph(f"{i}. {recommendation}", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        return filename
    
    def generate_csv_report(self, session) -> str:
        """Generate CSV report for data analysis"""
        filename = f"{self.reports_dir}/proctoring_data_{session.session_id}.csv"
        
        # Prepare event data
        events_data = []
        for event in session.events:
            events_data.append({
                "timestamp": event.timestamp.isoformat(),
                "event_type": event.event_type,
                "confidence": event.confidence,
                "details": json.dumps(event.details)
            })
        
        # Create DataFrame and save
        df = pd.DataFrame(events_data)
        df.to_csv(filename, index=False)
        
        return filename