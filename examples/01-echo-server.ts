/**
 * 예제 1: Echo 서버
 * 클라이언트가 보낸 메시지를 그대로 반환
 */

import { WebSocketLike } from '../src/websocket-like';
import { Message } from '../src/types';

async function main() {
  const server = new WebSocketLike(8080);

  // 메시지 수신
  server.onMessage(async (message: Message, clientId: string) => {
    console.log(`📨 Message from ${clientId}:`, message.data);

    // Echo 응답
    const response: Message = {
      type: 'echo',
      data: {
        original: message.data,
        timestamp: Date.now(),
        clientId,
      },
    };

    await server.send(clientId, response);
  });

  // 연결 이벤트
  server.onConnection(async (data: any) => {
    console.log(`🔗 Client connected: ${data.clientId}`);
    console.log(`👥 Total connected: ${server.getConnectedCount()}`);

    // 환영 메시지
    await server.send(data.clientId, {
      type: 'welcome',
      data: { message: 'Welcome to Echo Server', clientId: data.clientId },
    });
  });

  // 연결 해제 이벤트
  server.onDisconnection(async (clientId: string) => {
    console.log(`🔌 Client disconnected: ${clientId}`);
    console.log(`👥 Total connected: ${server.getConnectedCount()}`);
  });

  // 서버 시작
  await server.start();
  console.log('✅ Echo Server listening on port 8080');
  console.log('💡 Connect with: nc localhost 8080');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⛔ Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);
