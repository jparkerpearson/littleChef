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
      // When removing a node, also remove all its children
      const nodesToRemove = new Set<string>();
      const collectChildren = (nodeId: string) => {
        nodesToRemove.add(nodeId);
        const node = doc.nodes.find(n => n.id === nodeId);
        if (node?.children) {
          node.children.forEach(childId => collectChildren(childId));
        }
      };
      collectChildren(op.id);
      updatedDoc.nodes = doc.nodes.filter(node => !nodesToRemove.has(node.id));
      break;

    case 'reorder':
      // For now, we'll just update the node's position
      // In a more complex system, this might affect z-index
      updatedDoc.nodes = doc.nodes.map(node =>
        node.id === op.id ? { ...node, y: op.z } : node
      );
      break;

    case 'reparent':
      updatedDoc.nodes = doc.nodes.map(node => {
        if (node.id === op.id) {
          return { ...node, parentId: op.parentId || undefined };
        }
        return node;
      });
      break;

    case 'addChild':
      updatedDoc.nodes = doc.nodes.map(node => {
        if (node.id === op.parentId) {
          const children = node.children || [];
          return { ...node, children: [...children, op.childId] };
        }
        return node;
      });
      break;

    case 'removeChild':
      updatedDoc.nodes = doc.nodes.map(node => {
        if (node.id === op.parentId) {
          const children = node.children || [];
          return { ...node, children: children.filter(id => id !== op.childId) };
        }
        return node;
      });
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
    fill: '#ffffff',
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

// Hierarchical helper functions
export function getRootNodes(doc: Doc): Node[] {
  return doc.nodes.filter(node => !node.parentId);
}

export function getChildNodes(doc: Doc, parentId: string): Node[] {
  const parent = doc.nodes.find(n => n.id === parentId);
  if (!parent?.children) return [];
  return doc.nodes.filter(node => parent.children!.includes(node.id));
}

export function getAllDescendants(doc: Doc, nodeId: string): Node[] {
  const descendants: Node[] = [];
  const node = doc.nodes.find(n => n.id === nodeId);
  if (!node?.children) return descendants;

  const collectDescendants = (childId: string) => {
    const child = doc.nodes.find(n => n.id === childId);
    if (child) {
      descendants.push(child);
      if (child.children) {
        child.children.forEach(collectDescendants);
      }
    }
  };

  node.children.forEach(collectDescendants);
  return descendants;
}

export function getNodeDepth(doc: Doc, nodeId: string): number {
  const node = doc.nodes.find(n => n.id === nodeId);
  if (!node?.parentId) return 0;
  return 1 + getNodeDepth(doc, node.parentId);
}

export function isAncestor(doc: Doc, ancestorId: string, descendantId: string): boolean {
  const descendant = doc.nodes.find(n => n.id === descendantId);
  if (!descendant?.parentId) return false;
  if (descendant.parentId === ancestorId) return true;
  return isAncestor(doc, ancestorId, descendant.parentId);
}

export function canReparent(doc: Doc, nodeId: string, newParentId: string | null): boolean {
  if (!newParentId) return true; // Moving to root is always allowed
  if (nodeId === newParentId) return false; // Can't be parent of itself
  return !isAncestor(doc, nodeId, newParentId); // Can't create circular hierarchy
}

// Create a new group container node
export function createGroupNode(options: {
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
    width: options.width || 200,
    height: options.height || 200,
    fill: options.fill || 'transparent',
    stroke: options.stroke || '#4c93af',
    strokeWidth: options.strokeWidth || 2,
    cornerRadius: options.cornerRadius || 8,
    rotation: options.rotation || 0,
    children: [],
  };
}

// Group multiple nodes under a new container
export function groupNodes(doc: Doc, nodeIds: string[]): { ops: Op[]; groupId: string } {
  if (nodeIds.length < 2) {
    throw new Error('At least 2 nodes are required to create a group');
  }

  // Find the bounding box of all selected nodes
  const nodes = nodeIds.map(id => doc.nodes.find(n => n.id === id)).filter(Boolean) as Node[];
  if (nodes.length !== nodeIds.length) {
    throw new Error('Some nodes not found');
  }

  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.y + n.height));

  // Create group container with padding
  const padding = 20;
  const groupX = minX - padding;
  const groupY = minY - padding;
  const groupWidth = maxX - minX + (padding * 2);
  const groupHeight = maxY - minY + (padding * 2);

  const groupNode = createGroupNode({
    x: groupX,
    y: groupY,
    width: groupWidth,
    height: groupHeight,
  });

  const ops: Op[] = [];

  // Add the group node
  ops.push({ t: 'add', node: groupNode });

  // Reparent all selected nodes to the group
  nodeIds.forEach(nodeId => {
    ops.push({ t: 'reparent', id: nodeId, parentId: groupNode.id });
  });

  // Add children to the group node
  ops.push({
    t: 'update',
    id: groupNode.id,
    patch: { children: nodeIds }
  });

  return { ops, groupId: groupNode.id };
}

// Ungroup nodes from their parent
export function ungroupNodes(doc: Doc, groupId: string): Op[] {
  const groupNode = doc.nodes.find(n => n.id === groupId);
  if (!groupNode?.children) {
    throw new Error('Group node not found or has no children');
  }

  const ops: Op[] = [];

  // Remove parent relationship for all children
  groupNode.children.forEach(childId => {
    ops.push({ t: 'reparent', id: childId, parentId: null });
  });

  // Remove the group node
  ops.push({ t: 'remove', id: groupId });

  return ops;
}
