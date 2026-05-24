import { wsUrl } from './apiConfig';

export type CollabMessage =
  | { type: 'room_state'; data: Record<string, unknown> }
  | { type: 'event'; data: Record<string, unknown> }
  | { type: 'pong'; data: Record<string, unknown> };

type Handler = (msg: CollabMessage) => void;

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();

  connect(projectId: string, userId: string, userName: string) {
    this.disconnect();
    this.ws = new WebSocket(wsUrl(`/collaboration/ws/${projectId}/${userId}`));
    this.ws.onopen = () => {
      this.send({ action: 'join', user_name: userName });
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as CollabMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        /* ignore */
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(payload: Record<string, unknown>) {
    this.ws?.send(JSON.stringify(payload));
  }

  broadcastSelection(entityId: string, elementName: string) {
    this.send({
      action: 'broadcast',
      event_type: 'element_selected',
      payload: { entityId, elementName, timestamp: Date.now() },
    });
  }
}

export const collaborationClient = new CollaborationClient();
