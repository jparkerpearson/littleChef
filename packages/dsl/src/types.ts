// Core types for Little Chef DSL
export type ColorHex = string;

export interface RectNode {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: ColorHex;
  stroke?: ColorHex;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface TextNode {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: ColorHex;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
}

export interface ButtonNode {
  id: string;
  type: 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: ColorHex;
  stroke?: ColorHex;
  strokeWidth?: number;
  cornerRadius?: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textFill: ColorHex;
}

export interface ImageNode {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  cornerRadius?: number;
}

export type Node = RectNode | TextNode | ButtonNode | ImageNode;

export interface Doc {
  id: string;
  width: number;
  height: number;
  nodes: Node[];
  version: number;
  schemaVersion: number;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export type Op =
  | { t: 'add'; node: Node }
  | { t: 'update'; id: string; patch: Record<string, any> }
  | { t: 'remove'; id: string }
  | { t: 'reorder'; id: string; z: number };
