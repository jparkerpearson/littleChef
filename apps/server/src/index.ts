// Little Chef Server - Fastify API with WebSocket support
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { Store } from './store';
import { LLMClient } from './llm';
import { registerRoutes } from './routes';
import { WebSocketMessage } from './types';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '4000');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Debug port configuration
console.log('🔧 Environment variables:');
console.log('  PORT:', process.env.PORT || 'undefined (using default 4000)');
console.log('  GEMINI_API_KEY:', GEMINI_API_KEY ? 'set' : 'not set');
console.log('🚀 Starting server on port:', PORT);

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.warn('⚠️  GEMINI_API_KEY not set or using placeholder. LLM features will not work.');
  console.warn('   Set GEMINI_API_KEY in apps/server/.env to enable AI features.');
}

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    }
  });

  // Register plugins
  await fastify.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true
  });

  await fastify.register(websocket);

  // Initialize services
  const store = new Store();
  const llmClient = new LLMClient(GEMINI_API_KEY || '');

  // Register routes
  registerRoutes(fastify, store, llmClient);

  // WebSocket endpoint for real-time collaboration
  fastify.register(async function (fastify) {
    fastify.get('/v1/sync', { websocket: true }, (connection, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const docId = url.searchParams.get('docId');

      if (!docId) {
        connection.socket.close(1008, 'Missing docId parameter');
        return;
      }

      // Get current document state
      const doc = store.getDoc(docId);
      if (!doc) {
        connection.socket.close(1008, 'Document not found');
        return;
      }

      // Subscribe to document updates
      store.subscribe(docId, connection.socket);

      // Send initial state
      const message: WebSocketMessage = {
        type: 'hello',
        version: doc.version,
        snapshot: doc
      };
      connection.socket.send(JSON.stringify(message));

      // Handle incoming messages (for future features)
      connection.socket.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received WebSocket message:', data);
          // Handle client messages here if needed
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      // Handle disconnection
      connection.socket.on('close', () => {
        store.unsubscribe(docId, connection.socket);
        console.log(`WebSocket disconnected for doc ${docId}`);
      });

      console.log(`WebSocket connected for doc ${docId}`);
    });
  });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    
    await server.listen({ 
      port: PORT, 
      host: '0.0.0.0' 
    });
    
    console.log(`🚀 Little Chef server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/v1/sync`);
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      try {
        await server.close();
        console.log('Server closed successfully');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    };

    // Handle different termination signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
