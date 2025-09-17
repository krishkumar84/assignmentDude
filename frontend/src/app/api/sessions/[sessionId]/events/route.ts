import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { DetectionEvent, ProctorSession } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const events: DetectionEvent[] = await request.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid events data' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Add events to the session
    const eventsWithTimestamp = events.map(event => ({
      ...event,
      sessionId,
      timestamp: new Date(event.timestamp),
      id: `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    // Insert events
    await db.collection('events').insertMany(eventsWithTimestamp);

    // Update session statistics
    const eventCounts = {
      lookingAwayCount: 0,
      noFaceCount: 0,
      multipleFaceCount: 0,
      unauthorizedObjectCount: 0
    };

    events.forEach(event => {
      switch (event.eventType) {
        case 'looking_away':
          eventCounts.lookingAwayCount++;
          break;
        case 'no_face':
          eventCounts.noFaceCount++;
          break;
        case 'multiple_faces':
          eventCounts.multipleFaceCount++;
          break;
        case 'unauthorized_object':
          eventCounts.unauthorizedObjectCount++;
          break;
      }
    });

    // Calculate integrity score deductions
    const baseScore = 100;
    const deductions = 
      (eventCounts.lookingAwayCount * 2) +
      (eventCounts.noFaceCount * 3) +
      (eventCounts.multipleFaceCount * 10) +
      (eventCounts.unauthorizedObjectCount * 15);
    
    const integrityScore = Math.max(0, baseScore - deductions);

    // Update session
    await db.collection<ProctorSession>('sessions').updateOne(
      { sessionId },
      { 
        $inc: {
          totalEvents: events.length,
          lookingAwayCount: eventCounts.lookingAwayCount,
          noFaceCount: eventCounts.noFaceCount,
          multipleFaceCount: eventCounts.multipleFaceCount,
          unauthorizedObjectCount: eventCounts.unauthorizedObjectCount
        },
        $set: { integrityScore }
      }
    );

    return NextResponse.json({ 
      success: true,
      eventsAdded: events.length,
      integrityScore
    });
  } catch (error) {
    console.error('Failed to add events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add events' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const db = await getDatabase();
    
    const events = await db.collection<DetectionEvent>('events')
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      events: events.map(event => ({
        ...event,
        id: event._id?.toString()
      }))
    });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}