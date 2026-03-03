/**
 * 실시간 채팅 서버
 * 방(Room) 기반 채팅, 사용자 관리, 메시지 히스토리
 */

import { WebSocketLike } from './websocket-like';
import { ChatRoom, ChatMessage, Message } from './types';

export class ChatServer {
  private ws: WebSocketLike;
  private rooms: Map<string, ChatRoom> = new Map();
  private userToRoom: Map<string, string> = new Map(); // clientId -> roomId
  private usernames: Map<string, string> = new Map(); // clientId -> username
  private messageHistorySize: number = 100;

  constructor(port: number = 8080) {
    this.ws = new WebSocketLike(port);
    this.setupEventHandlers();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    this.ws.onConnection(async (data) => {
      console.log(`📍 Client connected: ${data.clientId}`);
    });

    this.ws.onMessage(async (message, clientId) => {
      await this.handleMessage(message, clientId);
    });

    this.ws.onDisconnection(async (clientId) => {
      await this.handleDisconnection(clientId);
    });
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(message: Message, clientId: string): Promise<void> {
    switch (message.type) {
      case 'join':
        await this.handleJoin(message, clientId);
        break;
      case 'message':
        await this.handleChatMessage(message, clientId);
        break;
      case 'leave':
        await this.handleLeave(clientId);
        break;
      case 'list-rooms':
        await this.handleListRooms(clientId);
        break;
      case 'list-members':
        await this.handleListMembers(message, clientId);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * 방 참여
   */
  private async handleJoin(message: Message, clientId: string): Promise<void> {
    const { room, username } = message.data;

    if (!room || !username) {
      await this.ws.send(clientId, {
        type: 'error',
        data: { message: 'Room and username required' },
      });
      return;
    }

    // 기존 방에서 나가기
    const currentRoom = this.userToRoom.get(clientId);
    if (currentRoom) {
      await this.handleLeave(clientId);
    }

    // 방 생성 또는 기존 방 가져오기
    if (!this.rooms.has(room)) {
      this.rooms.set(room, {
        id: room,
        name: room,
        members: new Set(),
        createdAt: Date.now(),
        messages: [],
      });
    }

    const chatRoom = this.rooms.get(room)!;

    // 방에 입장
    chatRoom.members.add(clientId);
    this.userToRoom.set(clientId, room);
    this.usernames.set(clientId, username);

    // 입장 메시지
    const joinMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: 'system',
      username: 'System',
      message: `${username} joined the room`,
      room,
      timestamp: Date.now(),
    };

    chatRoom.messages!.push(joinMessage);
    if (chatRoom.messages!.length > this.messageHistorySize) {
      chatRoom.messages!.shift();
    }

    // 모든 사용자에게 알림
    await this.ws.sendToGroup(Array.from(chatRoom.members), {
      type: 'user-joined',
      data: {
        userId: clientId,
        username,
        room,
        timestamp: Date.now(),
      },
    });

    // 클라이언트에게 방 정보 전송
    await this.ws.send(clientId, {
      type: 'joined',
      data: {
        room,
        members: Array.from(chatRoom.members),
        history: chatRoom.messages!.slice(-50), // 최근 50개 메시지
      },
    });
  }

  /**
   * 채팅 메시지 처리
   */
  private async handleChatMessage(message: Message, clientId: string): Promise<void> {
    const roomId = this.userToRoom.get(clientId);
    if (!roomId) {
      await this.ws.send(clientId, {
        type: 'error',
        data: { message: 'Not in a room' },
      });
      return;
    }

    const room = this.rooms.get(roomId)!;
    const username = this.usernames.get(clientId) || 'Anonymous';
    const { text, mentions } = message.data;

    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      userId: clientId,
      username,
      message: text,
      room: roomId,
      timestamp: Date.now(),
      mentions: mentions || [],
    };

    room.messages!.push(chatMessage);
    if (room.messages!.length > this.messageHistorySize) {
      room.messages!.shift();
    }

    // 방의 모든 사용자에게 메시지 전송
    await this.ws.sendToGroup(Array.from(room.members), {
      type: 'message',
      data: chatMessage,
    });
  }

  /**
   * 방 나가기
   */
  private async handleLeave(clientId: string): Promise<void> {
    const roomId = this.userToRoom.get(clientId);
    if (!roomId) return;

    const room = this.rooms.get(roomId)!;
    const username = this.usernames.get(clientId) || 'Anonymous';

    room.members.delete(clientId);
    this.userToRoom.delete(clientId);
    this.usernames.delete(clientId);

    // 나가기 메시지
    const leaveMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: 'system',
      username: 'System',
      message: `${username} left the room`,
      room: roomId,
      timestamp: Date.now(),
    };

    room.messages!.push(leaveMessage);

    // 남은 사용자들에게 알림
    if (room.members.size > 0) {
      await this.ws.sendToGroup(Array.from(room.members), {
        type: 'user-left',
        data: { userId: clientId, username, room: roomId },
      });
    } else {
      // 방이 비어졌으면 삭제
      this.rooms.delete(roomId);
    }
  }

  /**
   * 연결 해제 처리
   */
  private async handleDisconnection(clientId: string): Promise<void> {
    await this.handleLeave(clientId);
    console.log(`📴 Client disconnected: ${clientId}`);
  }

  /**
   * 방 목록
   */
  private async handleListRooms(clientId: string): Promise<void> {
    const roomList = Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      members: room.members.size,
      createdAt: room.createdAt,
    }));

    await this.ws.send(clientId, {
      type: 'room-list',
      data: { rooms: roomList },
    });
  }

  /**
   * 방의 멤버 목록
   */
  private async handleListMembers(message: Message, clientId: string): Promise<void> {
    const { room } = message.data;
    const chatRoom = this.rooms.get(room);

    if (!chatRoom) {
      await this.ws.send(clientId, {
        type: 'error',
        data: { message: 'Room not found' },
      });
      return;
    }

    const members = Array.from(chatRoom.members).map((memberId) => ({
      id: memberId,
      username: this.usernames.get(memberId) || 'Anonymous',
    }));

    await this.ws.send(clientId, {
      type: 'member-list',
      data: { room, members },
    });
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    await this.ws.start();
    console.log('✅ Chat Server started');
  }

  /**
   * 서버 중지
   */
  async stop(): Promise<void> {
    await this.ws.stop();
  }

  /**
   * 통계
   */
  getStats(): object {
    return {
      activeRooms: this.rooms.size,
      connectedClients: this.ws.getConnectedCount(),
      totalMessages: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + (room.messages?.length || 0),
        0
      ),
    };
  }
}
