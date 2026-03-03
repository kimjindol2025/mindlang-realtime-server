/**
 * 예제 3: 파일 전송 서버
 * Stream 기반 대용량 파일 전송, 청크 처리, 진행률 추적
 */

import { WebSocketLike } from '../src/websocket-like';
import { FileTransferManager } from '../src/file-transfer';
import { Message } from '../src/types';

async function main() {
  const server = new WebSocketLike(8080);
  const fileManager = new FileTransferManager(server, 64 * 1024); // 64KB 청크

  // 파일 전송 요청
  server.onMessage(async (message: Message, clientId: string) => {
    if (message.type === 'init-transfer') {
      const { file, recipientId } = message.data;

      try {
        const sessionId = await fileManager.initializeTransfer(
          clientId,
          {
            id: file.id || `file-${Date.now()}`,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType || 'application/octet-stream',
          },
          recipientId
        );

        await server.send(clientId, {
          type: 'transfer-initialized',
          data: { sessionId },
        });

        console.log(`📤 Transfer started: ${sessionId}`);
      } catch (error: any) {
        await server.send(clientId, {
          type: 'error',
          data: { message: error.message },
        });
      }
    }

    // 청크 수신
    if (message.type === 'file-chunk') {
      const { sessionId, chunkNumber, data } = message.data;

      try {
        const buffer = Buffer.from(data, 'base64');
        await fileManager.receiveChunk(sessionId, chunkNumber, buffer, clientId);
      } catch (error: any) {
        await server.send(clientId, {
          type: 'error',
          data: { message: error.message },
        });
      }
    }

    // 전송 취소
    if (message.type === 'cancel-transfer') {
      const { sessionId } = message.data;

      if (await fileManager.cancelTransfer(sessionId, clientId)) {
        console.log(`❌ Transfer cancelled: ${sessionId}`);
      }
    }

    // 세션 정보 조회
    if (message.type === 'get-session') {
      const { sessionId } = message.data;
      const session = fileManager.getSessionInfo(sessionId);

      await server.send(clientId, {
        type: 'session-info',
        data: {
          sessionId,
          session: session
            ? {
                status: session.status,
                uploadedChunks: session.uploadedChunks,
                totalChunks: session.totalChunks,
                progress: Math.round((session.uploadedChunks / session.totalChunks) * 100),
              }
            : null,
        },
      });
    }
  });

  // 연결 이벤트
  server.onConnection(async (data: any) => {
    console.log(`🔗 Client connected: ${data.clientId}`);

    await server.send(data.clientId, {
      type: 'welcome',
      data: {
        message: 'Welcome to File Transfer Server',
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
        chunkSize: 64 * 1024, // 64KB
      },
    });
  });

  // 정기적으로 만료된 세션 정리
  setInterval(async () => {
    await fileManager.cleanupExpiredSessions();
  }, 600000); // 10분마다

  // 통계 출력
  setInterval(() => {
    console.log(`📊 Active transfers: ${fileManager.getActiveSessions()}`);
  }, 30000); // 30초마다

  await server.start();
  console.log('✅ File Transfer Server listening on port 8080');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⛔ Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);
