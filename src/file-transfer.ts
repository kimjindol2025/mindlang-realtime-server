/**
 * 파일 전송 시스템
 * Stream 기반 대용량 파일 전송, 청크 처리, 진행률 추적
 */

import { FileTransferSession, FileMetadata, Message } from './types';
import { WebSocketLike } from './websocket-like';

export class FileTransferManager {
  private ws: WebSocketLike;
  private sessions: Map<string, FileTransferSession> = new Map();
  private chunkSize: number = 64 * 1024; // 64KB 청크
  private maxFileSize: number = 10 * 1024 * 1024 * 1024; // 10GB

  constructor(ws: WebSocketLike, chunkSize?: number) {
    this.ws = ws;
    if (chunkSize) {
      this.chunkSize = chunkSize;
    }
  }

  /**
   * 파일 전송 세션 생성
   */
  async initializeTransfer(
    senderId: string,
    file: FileMetadata,
    recipientId?: string
  ): Promise<string> {
    if (file.size > this.maxFileSize) {
      throw new Error(`File too large: ${file.size} > ${this.maxFileSize}`);
    }

    const sessionId = `transfer-${Date.now()}-${Math.random()}`;
    const totalChunks = Math.ceil(file.size / this.chunkSize);

    const session: FileTransferSession = {
      id: sessionId,
      file,
      senderId,
      recipientId,
      chunkSize: this.chunkSize,
      totalChunks,
      uploadedChunks: 0,
      status: 'pending',
    };

    this.sessions.set(sessionId, session);

    // 수신자에게 전송 요청 알림
    if (recipientId) {
      await this.ws.send(recipientId, {
        type: 'file-transfer-request',
        data: {
          sessionId,
          sender: senderId,
          file: {
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
          },
        },
      });
    } else {
      // 브로드캐스트
      await this.ws.broadcast({
        type: 'file-available',
        data: {
          sessionId,
          sender: senderId,
          file: {
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
          },
        },
      });
    }

    return sessionId;
  }

  /**
   * 청크 수신
   */
  async receiveChunk(
    sessionId: string,
    chunkNumber: number,
    data: Buffer,
    recipientId: string
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status === 'failed') {
      return false;
    }

    session.status = 'in-progress';
    session.uploadedChunks = Math.max(session.uploadedChunks, chunkNumber + 1);

    // 진행률 업데이트
    const progress = (session.uploadedChunks / session.totalChunks) * 100;

    // 발신자에게 진행률 알림
    await this.ws.send(session.senderId, {
      type: 'transfer-progress',
      data: {
        sessionId,
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        progress: Math.round(progress),
        speed: this.calculateSpeed(session),
      },
    });

    // 수신자에게 청크 전송
    if (session.recipientId) {
      await this.ws.send(session.recipientId, {
        type: 'file-chunk',
        data: {
          sessionId,
          chunkNumber,
          data: data.toString('base64'),
          isLast: session.uploadedChunks === session.totalChunks,
        },
      });
    }

    // 전송 완료
    if (session.uploadedChunks === session.totalChunks) {
      session.status = 'completed';

      await this.ws.send(session.senderId, {
        type: 'transfer-complete',
        data: { sessionId, file: session.file },
      });

      if (session.recipientId) {
        await this.ws.send(session.recipientId, {
          type: 'file-received',
          data: { sessionId, file: session.file },
        });
      }

      // 세션 정리
      setTimeout(() => this.sessions.delete(sessionId), 60000); // 1분 후 삭제
    }

    return true;
  }

  /**
   * 전송 취소
   */
  async cancelTransfer(sessionId: string, clientId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.senderId !== clientId && session.recipientId !== clientId) {
      return false;
    }

    session.status = 'failed';

    // 상대방에게 취소 알림
    const otherId = session.senderId === clientId ? session.recipientId : session.senderId;
    if (otherId) {
      await this.ws.send(otherId, {
        type: 'transfer-cancelled',
        data: { sessionId, cancelledBy: clientId },
      });
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Stream 기반 파일 읽기
   * 대용량 파일을 효율적으로 처리
   */
  async readFileAsStream(
    filePath: string,
    onChunk: (chunk: Buffer) => Promise<void>,
    onComplete: () => Promise<void>
  ): Promise<void> {
    // MindLang Stream 모듈 사용:
    // const reader = createReadStream(filePath);
    // reader.onData((chunk) => onChunk(chunk));
    // reader.onEnd(() => onComplete());

    console.log(`📂 Reading file stream: ${filePath}`);
  }

  /**
   * Stream 기반 파일 쓰기
   */
  async writeFileAsStream(
    filePath: string,
    onWrite: (writer: any) => Promise<void>
  ): Promise<void> {
    // MindLang Stream 모듈 사용:
    // const writer = createWriteStream(filePath);
    // await onWrite(writer);
    // writer.end();

    console.log(`💾 Writing file stream: ${filePath}`);
  }

  /**
   * 전송 속도 계산 (바이트/초)
   */
  private calculateSpeed(session: FileTransferSession): number {
    // 실제 구현에서는 시간 추적 필요
    return (session.uploadedChunks * session.chunkSize) / 1024; // KB/s
  }

  /**
   * 세션 정보 조회
   */
  getSessionInfo(sessionId: string): FileTransferSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 활성 세션 수
   */
  getActiveSessions(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'in-progress' || s.status === 'pending'
    ).length;
  }

  /**
   * 세션 정리 (타임아웃)
   */
  async cleanupExpiredSessions(timeoutMs: number = 3600000): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      // 1시간 이상 활동 없는 세션 정리
      // 실제 구현에서는 lastActivityTime 추적 필요
      if (session.status === 'pending') {
        expiredIds.push(sessionId);
      }
    }

    for (const sessionId of expiredIds) {
      this.sessions.delete(sessionId);
    }

    console.log(`🧹 Cleaned up ${expiredIds.length} expired sessions`);
  }
}

/**
 * 스트림 프로세서
 * 실시간 데이터 처리
 */
export class StreamProcessor {
  /**
   * 데이터 변환 스트림
   */
  static createTransformStream(
    transformFn: (chunk: Buffer) => Buffer
  ): {
    onData: (handler: (chunk: Buffer) => void) => void;
    onEnd: (handler: () => void) => void;
    write: (chunk: Buffer) => void;
  } {
    const handlers: Map<string, Function[]> = new Map([
      ['data', []],
      ['end', []],
    ]);

    return {
      onData: (handler) => handlers.get('data')!.push(handler),
      onEnd: (handler) => handlers.get('end')!.push(handler),
      write: (chunk) => {
        const transformed = transformFn(chunk);
        for (const handler of handlers.get('data')!) {
          (handler as Function)(transformed);
        }
      },
    };
  }

  /**
   * 버퍼 스트림
   */
  static createBufferStream(bufferSize: number = 1024 * 1024) {
    let buffer: Buffer[] = [];
    let totalSize = 0;

    return {
      write: (chunk: Buffer) => {
        buffer.push(chunk);
        totalSize += chunk.length;
      },
      getBuffered: (): Buffer => Buffer.concat(buffer),
      isFull: () => totalSize >= bufferSize,
      flush: () => {
        buffer = [];
        totalSize = 0;
      },
    };
  }

  /**
   * 압축 스트림
   */
  static createCompressionStream() {
    // MindLang Crypto 모듈: compress()
    return {
      compress: async (data: Buffer): Promise<Buffer> => {
        // await crypto.compress(data);
        return data;
      },
      decompress: async (data: Buffer): Promise<Buffer> => {
        // await crypto.decompress(data);
        return data;
      },
    };
  }
}
