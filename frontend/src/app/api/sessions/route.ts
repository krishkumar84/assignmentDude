import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ProctorSession } from "@/lib/types";

export async function GET() {
  try {
    const db = await getDatabase();
    const sessions = await db
      .collection<ProctorSession>("sessions")
      .find({})
      .sort({ startTime: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      sessions: sessions.map((session) => ({
        ...session,
        id: session._id?.toString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    // Check if this is just a candidate name (basic session creation)
    if (typeof requestData === 'string' || (requestData.candidateName && !requestData.sessionId)) {
      const candidateName = typeof requestData === 'string' ? requestData : requestData.candidateName;
      
      if (!candidateName?.trim()) {
        return NextResponse.json(
          { success: false, error: "Candidate name is required" },
          { status: 400 }
        );
      }

      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const session: ProctorSession = {
        sessionId,
        candidateName: candidateName.trim(),
        startTime: new Date(),
        duration: 0,
        totalEvents: 0,
        lookingAwayCount: 0,
        noFaceCount: 0,
        multipleFaceCount: 0,
        unauthorizedObjectCount: 0,
        integrityScore: 100,
        status: "active",
        events: [],
      };

      const db = await getDatabase();
      const result = await db
        .collection<ProctorSession>("sessions")
        .insertOne(session);

      return NextResponse.json({
        success: true,
        sessionId,
        candidateName,
        id: result.insertedId.toString(),
        startTime: session.startTime.toISOString(),
      });
    }
    
    // Handle complete session data (when saving finished session)
    else if (requestData.sessionId) {
      const sessionData = {
        ...requestData,
        startTime: new Date(requestData.startTime),
        endTime: new Date(requestData.endTime),
      };

      const db = await getDatabase();
      
      // Check if session already exists
      const existingSession = await db
        .collection<ProctorSession>("sessions")
        .findOne({ sessionId: requestData.sessionId });
      
      if (existingSession) {
        // Update existing session
        await db
          .collection<ProctorSession>("sessions")
          .updateOne(
            { sessionId: requestData.sessionId },
            { $set: sessionData }
          );
          
        return NextResponse.json({
          success: true,
          message: "Session updated successfully",
          sessionId: requestData.sessionId,
        });
      } else {
        // Insert new complete session
        const result = await db
          .collection<ProctorSession>("sessions")
          .insertOne(sessionData);

        return NextResponse.json({
          success: true,
          message: "Session saved successfully",
          sessionId: requestData.sessionId,
          id: result.insertedId.toString(),
        });
      }
    }
    
    else {
      return NextResponse.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error("Failed to create/save session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create/save session" },
      { status: 500 }
    );
  }
}
