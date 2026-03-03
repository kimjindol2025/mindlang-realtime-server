/**
 * MindLang Realtime Server - Type Definitions
 */

// 메시지 타입
export interface Message {
  type: 'text' | 'file' | 'binary' | 'ping' | 'pong' | 'error';
  data: any;
  timestamp?: number;
  clientId?: string;
  [key: string]: any;
}

// 연결된 클라이언트
export interface ConnectedClient {
  id: string;
  socket: any; // Socket 인스턴스
  isConnected: boolean;
  metadata?: Record<string, any>;
  lastMessageTime?: number;
}

// 채팅 메시지
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  room: string;
  timestamp: number;
  mentions?: string[];
}

// 채팅 방
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  members: Set<string>;
  maxMembers?: number;
  createdAt: number;
  messages?: ChatMessage[];
}

// 파일 메타데이터
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  checksum?: string;
  uploadedBy?: string;
  uploadedAt?: number;
}

// 파일 전송 세션
export interface FileTransferSession {
  id: string;
  file: FileMetadata;
  senderId: string;
  recipientId?: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

// Stream 이벤트
export interface StreamEvent {
  type: 'data' | 'end' | 'error';
  chunk?: Buffer;
  error?: Error;
}

// 서버 설정
export interface RealtimeServerConfig {
  host: string;
  port: number;
  maxConnections?: number;
  maxMessageSize?: number; // 바이트
  chunkSize?: number; // 파일 전송 청크 크기
  idleTimeout?: number; // 밀리초
}
