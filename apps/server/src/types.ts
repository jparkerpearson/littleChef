// Server-specific types
export interface CreateDocRequest {
  width?: number;
  height?: number;
  title?: string;
}

export interface CreateDocResponse {
  doc: any; // Doc type from DSL
}

export interface GetDocResponse {
  snapshot: any; // Doc type from DSL
  opsSince: any[]; // Op[] type from DSL
  version: number;
}

export interface AppendOpsRequest {
  docId: string;
  ops: any[]; // Op[] type from DSL
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
  ops: any[]; // Op[] type from DSL
  version: number;
}

export interface WebSocketMessage {
  type: 'hello' | 'ops';
  version?: number;
  snapshot?: any; // Doc type from DSL
  ops?: any[]; // Op[] type from DSL
}
