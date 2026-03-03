/**
 * WebSocket 유사 구현
 * MindLang Socket 모듈을 기반으로 한 양방향 통신
 */

import { Message, ConnectedClient } from './types';

export class WebSocketLike {
  private clients: Map<string, ConnectedClient> = new Map();
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private port: number;
  private maxConnections: number = 1000;

  constructor(port: number = 8080) {
    this.port = port;
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    console.log(`🚀 WebSocket-like Server starting on port ${this.port}...`);
    // Socket.createServer() 사용하여 서버 생성
  }

  /**
   * 클라이언트 연결 처리
   */
  async handleConnection(socket: any, clientId: string): Promise<void> {
    if (this.clients.size >= this.maxConnections) {
      this.emit('error', { message: 'Server full', clientId });
      return;
    }

    const client: ConnectedClient = {
      id: clientId,
      socket,
      isConnected: true,
      metadata: {},
      lastMessageTime: Date.now(),
    };

    this.clients.set(clientId, client);
    this.emit('connection', { clientId, timestamp: Date.now() });

    // 메시지 수신 대기
    await this.listenForMessages(client);
  }

  /**
   * 메시지 수신
   */
  private async listenForMessages(client: ConnectedClient): Promise<void> {
    try {
      while (client.isConnected) {
        // socket.onMessage() 또는 socket.read() 사용
        // 실제 구현에서는 MindLang Socket API 사용
        await new Promise((resolve) => {
          // 메시지 대기
          setTimeout(resolve, 100);
        });
      }
    } catch (error) {
      this.emit('error', { clientId: client.id, error });
      this.disconnect(client.id);
    }
  }

  /**
   * 메시지 수신 (Socket 이벤트)
   */
  onMessage(handler: (message: Message, clientId: string) => Promise<void>): void {
    if (!this.eventHandlers.has('message')) {
      this.eventHandlers.set('message', new Set());
    }
    this.eventHandlers.get('message')!.add(handler);
  }

  /**
   * 연결 이벤트
   */
  onConnection(handler: (data: any) => Promise<void>): void {
    if (!this.eventHandlers.has('connection')) {
      this.eventHandlers.set('connection', new Set());
    }
    this.eventHandlers.get('connection')!.add(handler);
  }

  /**
   * 연결 해제 이벤트
   */
  onDisconnection(handler: (clientId: string) => Promise<void>): void {
    if (!this.eventHandlers.has('disconnection')) {
      this.eventHandlers.set('disconnection', new Set());
    }
    this.eventHandlers.get('disconnection')!.add(handler);
  }

  /**
   * 메시지 전송 (특정 클라이언트)
   */
  async send(clientId: string, message: Message): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client || !client.isConnected) {
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      // socket.write(payload) 사용
      client.lastMessageTime = Date.now();
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * 브로드캐스트 (모든 클라이언트에게 전송)
   */
  async broadcast(message: Message, excludeClientId?: string): Promise<number> {
    let sent = 0;

    for (const [clientId, client] of this.clients) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      if (await this.send(clientId, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * 그룹에 메시지 전송
   */
  async sendToGroup(groupIds: string[], message: Message, excludeClientId?: string): Promise<number> {
    let sent = 0;

    for (const clientId of groupIds) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      if (await this.send(clientId, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * 클라이언트 연결 해제
   */
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isConnected = false;
      // socket.close() 호출
      this.clients.delete(clientId);
      this.emit('disconnection', clientId);
    }
  }

  /**
   * 이벤트 발생
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data).catch((error) => {
          console.error(`Error in ${event} handler:`, error);
        });
      }
    }
  }

  /**
   * 연결된 클라이언트 수
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * 특정 클라이언트 정보
   */
  getClient(clientId: string): ConnectedClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * 모든 클라이언트 ID
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 서버 종료
   */
  async stop(): Promise<void> {
    for (const clientId of this.clients.keys()) {
      this.disconnect(clientId);
    }
    this.clients.clear();
    console.log('🛑 Server stopped');
  }
}
