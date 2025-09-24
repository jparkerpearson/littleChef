import { Doc, Node, Op, RectNode, TextNode, ButtonNode, ImageNode } from './types';
import { validateDoc, validateOps } from './schemas';

// Generate a unique ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Create a new document
export function newDoc(options: { width: number; height: number; title?: string }): Doc {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    width: options.width,
    height: options.height,
    nodes: [],
    version: 0,
    schemaVersion: 1,
    title: options.title,
    createdAt: now,
    updatedAt: now,
  };
}

// Apply a single operation to a document
export function applyOp(doc: Doc, op: Op): Doc {
  const updatedDoc = { ...doc };

  switch (op.t) {
    case 'add':
      updatedDoc.nodes = [...doc.nodes, op.node];
      break;

    case 'update':
      updatedDoc.nodes = doc.nodes.map(node =>
        node.id === op.id ? { ...node, ...op.patch } : node
      );
      break;

    case 'remove':
      updatedDoc.nodes = doc.nodes.filter(node => node.id !== op.id);
      break;

    case 'reorder':
      // For now, we'll just update the node's position
      // In a more complex system, this might affect z-index
      updatedDoc.nodes = doc.nodes.map(node =>
        node.id === op.id ? { ...node, y: op.z } : node
      );
      break;
  }

  updatedDoc.version += 1;
  updatedDoc.updatedAt = new Date().toISOString();

  return updatedDoc;
}

// Apply multiple operations to a document
export function applyOps(doc: Doc, ops: Op[]): Doc {
  return ops.reduce(applyOp, doc);
}

// Validate and apply operations
export function validateAndApplyOps(doc: Doc, opsJson: unknown): Doc {
  const ops = validateOps(opsJson);
  return applyOps(doc, ops);
}

// Snap coordinates to 8px grid
export function snapToGrid(value: number): number {
  return Math.round(value / 8) * 8;
}

// Ensure button meets minimum height requirement
export function ensureMinButtonHeight(height: number): number {
  return Math.max(height, 44);
}

// Get document summary for LLM context
export function getDocSummary(doc: Doc): string {
  const nodeCounts = doc.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return `Document ${doc.id}: ${doc.width}x${doc.height}px, ${doc.nodes.length} nodes (${Object.entries(nodeCounts).map(([type, count]) => `${count} ${type}`).join(', ')})`;
}

// Create a new rectangle node
export function createRectNode(options: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  rotation?: number;
}): RectNode {
  return {
    id: generateId(),
    type: 'rect',
    x: options.x,
    y: options.y,
    width: options.width || 100,
    height: options.height || 100,
    fill: options.fill || '#3b82f6',
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    cornerRadius: options.cornerRadius,
    rotation: options.rotation || 0,
  };
}

// Create a new text node
export function createTextNode(options: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  rotation?: number;
}): TextNode {
  return {
    id: generateId(),
    type: 'text',
    x: options.x,
    y: options.y,
    width: options.width || 200,
    height: options.height || 50,
    text: options.text || 'Text',
    fontSize: options.fontSize || 16,
    fontFamily: options.fontFamily || 'Arial',
    fontWeight: options.fontWeight || 'normal',
    fill: options.fill || '#000000',
    align: options.align || 'left',
    verticalAlign: options.verticalAlign || 'top',
    rotation: options.rotation || 0,
  };
}

// Create a new button node
export function createButtonNode(options: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textFill?: string;
  rotation?: number;
}): ButtonNode {
  return {
    id: generateId(),
    type: 'button',
    x: options.x,
    y: options.y,
    width: options.width || 120,
    height: ensureMinButtonHeight(options.height || 44),
    label: options.label || 'Button',
    fill: options.fill || '#10b981',
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    cornerRadius: options.cornerRadius || 8,
    fontSize: options.fontSize || 14,
    fontFamily: options.fontFamily || 'Arial',
    fontWeight: options.fontWeight || 'normal',
    textFill: options.textFill || '#ffffff',
    rotation: options.rotation || 0,
  };
}

// Create a new image node
export function createImageNode(options: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  src?: string;
  cornerRadius?: number;
  rotation?: number;
}): ImageNode {
  return {
    id: generateId(),
    type: 'image',
    x: options.x,
    y: options.y,
    width: options.width || 200,
    height: options.height || 150,
    src: options.src || '',
    cornerRadius: options.cornerRadius,
    rotation: options.rotation || 0,
  };
}

// Migration utilities (placeholder for future schema changes)
export function migrateDoc(doc: Doc): Doc {
  if (doc.schemaVersion < 1) {
    // Future migration logic here
    return { ...doc, schemaVersion: 1 };
  }
  return doc;
}
