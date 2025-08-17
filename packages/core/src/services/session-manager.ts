import { ActionResult } from '../types';

export interface Session {
  id: string;
  instruction: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  results: ActionResult[];
  error?: string;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private currentSessionId?: string;

  createSession(instruction: string, metadata?: Record<string, any>): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: Session = {
      id: sessionId,
      instruction,
      startTime: Date.now(),
      status: 'running',
      results: [],
      metadata
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    console.log(`Created new session: ${sessionId}`, { instruction, metadata });
    return sessionId;
  }

  updateSession(sessionId: string, updates: Partial<Session>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    Object.assign(session, updates);
    
    if (updates.status && updates.status !== 'running' && !session.endTime) {
      session.endTime = Date.now();
    }

    this.sessions.set(sessionId, session);
    console.log(`Updated session: ${sessionId}`, updates);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getCurrentSession(): Session | undefined {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
  }

  getSessionHistory(limit: number = 10): Session[] {
    return this.getAllSessions()
      .filter(s => s.status !== 'running')
      .slice(0, limit);
  }

  addResult(sessionId: string, result: ActionResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    session.results.push(result);
    this.sessions.set(sessionId, session);
  }

  completeSession(sessionId: string, success: boolean = true, error?: string): void {
    this.updateSession(sessionId, {
      status: success ? 'completed' : 'error',
      error: error,
      endTime: Date.now()
    });

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  cancelSession(sessionId: string): void {
    this.updateSession(sessionId, {
      status: 'cancelled',
      endTime: Date.now()
    });

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
  }

  getSessionStats(sessionId: string): {
    duration: number;
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    successRate: number;
  } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const duration = (session.endTime || Date.now()) - session.startTime;
    const totalActions = session.results.length;
    const successfulActions = session.results.filter(r => r.success).length;
    const failedActions = totalActions - successfulActions;
    const successRate = totalActions > 0 ? successfulActions / totalActions : 0;

    return {
      duration,
      totalActions,
      successfulActions,
      failedActions,
      successRate
    };
  }

  exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return JSON.stringify(session, null, 2);
  }

  importSession(sessionData: string): string {
    try {
      const session: Session = JSON.parse(sessionData);
      
      // Generate new ID to avoid conflicts
      const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      session.id = newId;
      
      this.sessions.set(newId, session);
      return newId;
    } catch (error) {
      throw new Error(`Failed to import session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  clearOldSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAge;
    let cleared = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < cutoffTime && session.status !== 'running') {
        this.sessions.delete(sessionId);
        cleared++;
      }
    }

    console.log(`Cleared ${cleared} old sessions`);
    return cleared;
  }

  getSessionSummary(): {
    total: number;
    running: number;
    completed: number;
    error: number;
    cancelled: number;
  } {
    const sessions = Array.from(this.sessions.values());
    
    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      error: sessions.filter(s => s.status === 'error').length,
      cancelled: sessions.filter(s => s.status === 'cancelled').length
    };
  }
}
