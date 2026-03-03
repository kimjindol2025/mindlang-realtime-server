/**
 * 예제 4: 스트리밍 API
 * Stream 기반 실시간 데이터 처리
 */

import { WebSocketLike } from '../src/websocket-like';
import { StreamProcessor } from '../src/file-transfer';
import { Message } from '../src/types';

async function main() {
  const server = new WebSocketLike(8080);

  // 실시간 데이터 스트림
  const dataStream = StreamProcessor.createTransformStream((chunk) => {
    // 데이터 변환 예: 대문자로 변환
    return Buffer.from(chunk.toString().toUpperCase());
  });

  // 클라이언트 메시지 처리
  server.onMessage(async (message: Message, clientId: string) => {
    if (message.type === 'stream-data') {
      const { data } = message.data;
      const chunk = Buffer.from(data, 'base64');

      // 스트림에 데이터 쓰기
      dataStream.write(chunk);
    }

    // 대용량 스트리밍 시작
    if (message.type === 'start-stream') {
      const { dataSize, chunkSize } = message.data;

      await streamLargeData(clientId, server, dataSize, chunkSize || 4096);
    }

    // 압축 스트리밍
    if (message.type === 'compress-stream') {
      const { data } = message.data;
      const compressor = StreamProcessor.createCompressionStream();

      const buffer = Buffer.from(data, 'base64');
      const compressed = await compressor.compress(buffer);

      await server.send(clientId, {
        type: 'compressed-data',
        data: {
          originalSize: buffer.length,
          compressedSize: compressed.length,
          compressionRatio: (
            (1 - compressed.length / buffer.length) * 100
          ).toFixed(2),
          data: compressed.toString('base64'),
        },
      });
    }
  });

  // 데이터 스트림 이벤트
  dataStream.onData((chunk) => {
    console.log(`📊 Processed chunk: ${chunk.length} bytes`);
  });

  dataStream.onEnd(async () => {
    console.log('✅ Stream processing complete');
  });

  // 연결 이벤트
  server.onConnection(async (data: any) => {
    console.log(`🔗 Client connected: ${data.clientId}`);

    await server.send(data.clientId, {
      type: 'welcome',
      data: {
        message: 'Welcome to Streaming API',
        features: [
          'Real-time data streaming',
          'Large file streaming',
          'Data compression',
          'Transform streams',
        ],
      },
    });
  });

  await server.start();
  console.log('✅ Streaming API Server listening on port 8080');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⛔ Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

/**
 * 대용량 데이터 스트리밍 시뮬레이션
 */
async function streamLargeData(
  clientId: string,
  server: WebSocketLike,
  totalSize: number,
  chunkSize: number
): Promise<void> {
  const totalChunks = Math.ceil(totalSize / chunkSize);
  let sentBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const currentChunkSize = Math.min(chunkSize, totalSize - sentBytes);
    const chunk = Buffer.alloc(currentChunkSize, Math.random() * 256 | 0);

    await server.send(clientId, {
      type: 'stream-chunk',
      data: {
        chunkNumber: i,
        totalChunks,
        size: currentChunkSize,
        progress: Math.round((sentBytes / totalSize) * 100),
        data: chunk.toString('base64'),
      },
    });

    sentBytes += currentChunkSize;

    // 실시간 느낌을 위해 약간의 지연
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await server.send(clientId, {
    type: 'stream-complete',
    data: {
      totalSize,
      totalChunks,
      duration: Date.now(),
    },
  });

  console.log(`📤 Streamed ${totalSize} bytes to ${clientId}`);
}

main().catch(console.error);
