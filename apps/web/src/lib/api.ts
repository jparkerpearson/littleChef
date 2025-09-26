// API client for Little Chef
import { Doc, Op } from '@little-chef/dsl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface CreateDocRequest {
  width?: number;
  height?: number;
  title?: string;
}

export interface CreateDocResponse {
  doc: Doc;
}

export interface GetDocResponse {
  snapshot: Doc;
  opsSince: Op[];
  version: number;
}

export interface AppendOpsRequest {
  docId: string;
  ops: Op[];
}

export interface AppendOpsResponse {
  ok: boolean;
  version: number;
}

export interface GenerateRequest {
  docId: string;
  prompt: string;
  palette?: string[];
}

export interface GenerateResponse {
  ops: Op[];
  version: number;
}

export interface CachedResponse {
  id: string;
  timestamp: number;
  prompt: string;
  docId: string;
  docSummary: string;
  palette?: string[];
  ops: Op[];
  requestId: string;
}

export interface CacheListResponse {
  responses: CachedResponse[];
}

export interface CacheLoadRequest {
  docId: string;
}

export interface CacheLoadResponse {
  ops: Op[];
  version: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async createDoc(request: CreateDocRequest): Promise<CreateDocResponse> {
    const response = await fetch(`${this.baseUrl}/v1/doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create document: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchDoc(id: string, since?: number): Promise<GetDocResponse> {
    const url = new URL(`${this.baseUrl}/v1/doc/${id}`);
    if (since !== undefined) {
      url.searchParams.set('since', since.toString());
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }

    return response.json();
  }

  async appendOps(docId: string, ops: Op[]): Promise<AppendOpsResponse> {
    const response = await fetch(`${this.baseUrl}/v1/ops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId, ops }),
    });

    if (!response.ok) {
      throw new Error(`Failed to append operations: ${response.statusText}`);
    }

    return response.json();
  }

  async generateOps(docId: string, prompt: string, palette?: string[]): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId, prompt, palette }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate operations: ${response.statusText}`);
    }

    return response.json();
  }

  async listDocs(): Promise<{ docs: Doc[] }> {
    const response = await fetch(`${this.baseUrl}/v1/docs`);

    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.statusText}`);
    }

    return response.json();
  }

  async listCachedResponses(): Promise<CacheListResponse> {
    const response = await fetch(`${this.baseUrl}/v1/cache`);

    if (!response.ok) {
      throw new Error(`Failed to list cached responses: ${response.statusText}`);
    }

    return response.json();
  }

  async loadCachedResponse(cacheId: string, docId: string): Promise<CacheLoadResponse> {
    const response = await fetch(`${this.baseUrl}/v1/cache/${cacheId}/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to load cached response: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteCachedResponse(cacheId: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/v1/cache/${cacheId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete cached response: ${response.statusText}`);
    }

    return response.json();
  }

  connectWS(docId: string, onMessage: (message: any) => void): WebSocket {
    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/v1/sync?docId=${docId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return ws;
  }
}

export const apiClient = new ApiClient();
