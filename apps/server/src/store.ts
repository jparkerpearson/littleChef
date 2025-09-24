// In-memory store for documents and operations
import { Doc, Op } from '@little-chef/dsl';

export class Store {
  private docs = new Map<string, Doc>();
  private opLogs = new Map<string, Op[]>();
  private subscribers = new Map<string, Set<any>>(); // WebSocket connections

  // Document operations
  createDoc(doc: Doc): void {
    this.docs.set(doc.id, doc);
    this.opLogs.set(doc.id, []);
  }

  getDoc(id: string): Doc | undefined {
    return this.docs.get(id);
  }

  updateDoc(doc: Doc): void {
    this.docs.set(doc.id, doc);
  }

  // Operation log operations
  appendOps(docId: string, ops: Op[]): void {
    const existingOps = this.opLogs.get(docId) || [];
    this.opLogs.set(docId, [...existingOps, ...ops]);
  }

  getOpsSince(docId: string, version: number): Op[] {
    const allOps = this.opLogs.get(docId) || [];
    return allOps.slice(version);
  }

  getAllOps(docId: string): Op[] {
    return this.opLogs.get(docId) || [];
  }

  // WebSocket subscription management
  subscribe(docId: string, ws: any): void {
    if (!this.subscribers.has(docId)) {
      this.subscribers.set(docId, new Set());
    }
    this.subscribers.get(docId)!.add(ws);
  }

  unsubscribe(docId: string, ws: any): void {
    const subs = this.subscribers.get(docId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        this.subscribers.delete(docId);
      }
    }
  }

  broadcast(docId: string, message: any): void {
    const subs = this.subscribers.get(docId);
    if (subs) {
      subs.forEach(ws => {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting to WebSocket:', error);
          // Remove broken connection
          subs.delete(ws);
        }
      });
    }
  }

  // Utility methods
  getAllDocs(): Doc[] {
    return Array.from(this.docs.values());
  }

  getSubscriberCount(docId: string): number {
    return this.subscribers.get(docId)?.size || 0;
  }
}
