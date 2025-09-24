// Fastify routes for Little Chef API
import { FastifyInstance } from 'fastify';
import { Doc, Op, newDoc, applyOps, validateOps } from '@little-chef/dsl';
import { Store } from './store';
import { LLMClient } from './llm';
import { CreateDocRequest, CreateDocResponse, GetDocResponse, AppendOpsRequest, AppendOpsResponse, GenerateRequest, GenerateResponse } from './types';

export function registerRoutes(fastify: FastifyInstance, store: Store, llmClient: LLMClient) {
  // Create a new document
  fastify.post('/v1/doc', async (request, reply) => {
    try {
      const { width = 800, height = 600, title } = request.body as CreateDocRequest;
      
      const doc = newDoc({ width, height, title });
      store.createDoc(doc);
      
      return { doc };
    } catch (error) {
      reply.code(400);
      return { error: 'Invalid request body' };
    }
  });

  // Get document with operations since version
  fastify.get<{ Params: { id: string }; Querystring: { since?: string } }>('/v1/doc/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const since = request.query.since ? parseInt(request.query.since) : 0;
      
      const doc = store.getDoc(id);
      if (!doc) {
        reply.code(404);
        return { error: 'Document not found' };
      }
      
      const opsSince = store.getOpsSince(id, since);
      
      return {
        snapshot: doc,
        opsSince,
        version: doc.version
      };
    } catch (error) {
      reply.code(400);
      return { error: 'Invalid request' };
    }
  });

  // Append operations to document
  fastify.post('/v1/ops', async (request, reply) => {
    try {
      const { docId, ops } = request.body as AppendOpsRequest;
      
      // Validate operations
      const validatedOps = validateOps(ops);
      
      // Get current document
      const doc = store.getDoc(docId);
      if (!doc) {
        reply.code(404);
        return { error: 'Document not found' };
      }
      
      // Apply operations
      const updatedDoc = applyOps(doc, validatedOps);
      
      // Store updates
      store.updateDoc(updatedDoc);
      store.appendOps(docId, validatedOps);
      
      // Broadcast to WebSocket subscribers
      store.broadcast(docId, {
        type: 'ops',
        ops: validatedOps,
        version: updatedDoc.version
      });
      
      return { ok: true, version: updatedDoc.version };
    } catch (error) {
      reply.code(400);
      return { error: 'Invalid operations' };
    }
  });

  // Generate operations using LLM
  fastify.post('/v1/generate', async (request, reply) => {
    try {
      const { docId, prompt, palette } = request.body as GenerateRequest;
      
      // Get current document
      const doc = store.getDoc(docId);
      if (!doc) {
        reply.code(404);
        return { error: 'Document not found' };
      }
      
      // Generate operations using LLM
      const ops = await llmClient.generateOps(doc, prompt, palette);
      
      // Apply operations
      const updatedDoc = applyOps(doc, ops);
      
      // Store updates
      store.updateDoc(updatedDoc);
      store.appendOps(docId, ops);
      
      // Broadcast to WebSocket subscribers
      store.broadcast(docId, {
        type: 'ops',
        ops,
        version: updatedDoc.version
      });
      
      return { ops, version: updatedDoc.version };
    } catch (error) {
      console.error('Generate error:', error);
      reply.code(422);
      return { error: 'The recipe didn\'t validate. Trying a simpler plating.' };
    }
  });

  // List all documents
  fastify.get('/v1/docs', async (request, reply) => {
    try {
      const docs = store.getAllDocs();
      return { docs };
    } catch (error) {
      reply.code(500);
      return { error: 'Internal server error' };
    }
  });
}
