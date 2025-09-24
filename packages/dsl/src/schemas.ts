import { z } from 'zod';

// Color validation - hex color with optional alpha
export const ColorHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

// Base node properties
const BaseNodeSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

// Node type schemas
export const RectNodeSchema = BaseNodeSchema.extend({
  type: z.literal('rect'),
  fill: ColorHexSchema,
  stroke: ColorHexSchema.optional(),
  strokeWidth: z.number().int().min(0).optional(),
  cornerRadius: z.number().int().min(0).optional(),
});

export const TextNodeSchema = BaseNodeSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontSize: z.number().int().min(8).max(72),
  fontFamily: z.string().min(1),
  fontWeight: z.string(),
  fill: ColorHexSchema,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
});

export const ButtonNodeSchema = BaseNodeSchema.extend({
  type: z.literal('button'),
  label: z.string(),
  fill: ColorHexSchema,
  stroke: ColorHexSchema.optional(),
  strokeWidth: z.number().int().min(0).optional(),
  cornerRadius: z.number().int().min(0).optional(),
  fontSize: z.number().int().min(8).max(72),
  fontFamily: z.string().min(1),
  fontWeight: z.string(),
  textFill: ColorHexSchema,
});

export const ImageNodeSchema = BaseNodeSchema.extend({
  type: z.literal('image'),
  src: z.string().url(),
  cornerRadius: z.number().int().min(0).optional(),
});

// Union of all node types
export const NodeSchema = z.discriminatedUnion('type', [
  RectNodeSchema,
  TextNodeSchema,
  ButtonNodeSchema,
  ImageNodeSchema,
]);

// Document schema
export const DocSchema = z.object({
  id: z.string().min(1),
  width: z.number().int().min(100).max(2000),
  height: z.number().int().min(100).max(2000),
  nodes: z.array(NodeSchema),
  version: z.number().int().min(0),
  schemaVersion: z.number().int().min(1),
  title: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Operation schemas
export const OpSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('add'),
    node: NodeSchema,
  }),
  z.object({
    t: z.literal('update'),
    id: z.string().min(1),
    patch: z.record(z.any()), // Partial<Node> validation happens in helpers
  }),
  z.object({
    t: z.literal('remove'),
    id: z.string().min(1),
  }),
  z.object({
    t: z.literal('reorder'),
    id: z.string().min(1),
    z: z.number().int(),
  }),
]);

// Array of operations
export const OpsSchema = z.array(OpSchema);

// Validation helpers
export function validateDoc(json: unknown) {
  return DocSchema.parse(json);
}

export function validateOps(json: unknown) {
  return OpsSchema.parse(json);
}

export function validateNode(json: unknown) {
  return NodeSchema.parse(json);
}
