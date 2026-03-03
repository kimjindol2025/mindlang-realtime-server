/**
 * 예제 2: 실시간 채팅 서버
 * 방(Room) 기반 채팅, 사용자 관리, 메시지 히스토리
 */

import { ChatServer } from '../src/chat-server';

async function main() {
  const chatServer = new ChatServer(8080);

  // 서버 시작
  await chatServer.start();
  console.log('✅ Chat Server listening on port 8080');

  // 통계 출력
  setInterval(() => {
    const stats = chatServer.getStats();
    console.log('📊 Server Stats:', stats);
  }, 30000); // 30초마다

  // 테스트 클라이언트 시뮬레이션 (데모용)
  if (process.env.DEMO === 'true') {
    setTimeout(() => {
      simulateClients(chatServer);
    }, 1000);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⛔ Shutting down...');
    await chatServer.stop();
    process.exit(0);
  });
}

/**
 * 테스트용 클라이언트 시뮬레이션
 */
async function simulateClients(chatServer: ChatServer) {
  console.log('🤖 Simulating clients...');

  // 이 부분은 실제 클라이언트 구현 필요
  // WebSocket/Socket 클라이언트가 다음 메시지를 보냄:

  const messages = [
    { type: 'join', data: { room: 'general', username: 'Alice' } },
    { type: 'join', data: { room: 'general', username: 'Bob' } },
    { type: 'join', data: { room: 'random', username: 'Charlie' } },
    { type: 'message', data: { text: 'Hello everyone!' } },
    { type: 'message', data: { text: 'Hi Alice!' } },
    { type: 'list-rooms', data: {} },
    { type: 'list-members', data: { room: 'general' } },
  ];

  console.log('📝 Sample messages to send:');
  messages.forEach((msg) => {
    console.log(`  ${JSON.stringify(msg)}`);
  });
}

main().catch(console.error);
