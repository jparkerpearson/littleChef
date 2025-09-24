// React-Konva canvas component for Little Chef editor
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { Doc, Node, Op, applyOps, snapToGrid } from '@little-chef/dsl';
import { apiClient } from '../lib/api';

interface CanvasProps {
  doc: Doc;
  onDocChange: (doc: Doc) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  zoom: number;
  pan: { x: number; y: number };
}

export function Canvas({ doc, onDocChange, selectedIds, onSelectionChange, zoom, pan }: CanvasProps) {
  const stageRef = useRef<any>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Handle node selection
  const handleNodeClick = (nodeId: string, event: any) => {
    event.cancelBubble = true;
    
    if (event.evt.ctrlKey || event.evt.metaKey) {
      // Multi-select
      if (selectedIds.includes(nodeId)) {
        onSelectionChange(selectedIds.filter(id => id !== nodeId));
      } else {
        onSelectionChange([...selectedIds, nodeId]);
      }
    } else {
      // Single select
      onSelectionChange([nodeId]);
    }
  };

  // Handle stage click (deselect)
  const handleStageClick = (event: any) => {
    if (event.target === event.target.getStage()) {
      onSelectionChange([]);
    }
  };

  // Handle drag start
  const handleDragStart = (nodeId: string, event: any) => {
    setDragging(true);
    setDragStart({ x: event.target.x(), y: event.target.y() });
  };

  // Handle drag end
  const handleDragEnd = (nodeId: string, event: any) => {
    if (!dragging) return;
    
    const newX = snapToGrid(event.target.x());
    const newY = snapToGrid(event.target.y());
    
    // Only update if position actually changed
    if (newX !== dragStart.x || newY !== dragStart.y) {
      const op: Op = {
        t: 'update',
        id: nodeId,
        patch: { x: newX, y: newY }
      };
      
      // Apply operation locally first
      const updatedDoc = applyOps(doc, [op]);
      onDocChange(updatedDoc);
      
      // Send to server
      apiClient.appendOps(doc.id, [op]).catch(console.error);
    }
    
    setDragging(false);
  };

  // Render different node types
  const renderNode = (node: Node) => {
    const isSelected = selectedIds.includes(node.id);
    const strokeColor = isSelected ? '#4c93af' : node.stroke || 'transparent';
    const strokeWidth = isSelected ? 2 : node.strokeWidth || 0;

    switch (node.type) {
      case 'rect':
        return (
          <Rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            fill={node.fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            cornerRadius={node.cornerRadius || 0}
            draggable
            onClick={(e) => handleNodeClick(node.id, e)}
            onDragStart={(e) => handleDragStart(node.id, e)}
            onDragEnd={(e) => handleDragEnd(node.id, e)}
          />
        );

      case 'text':
        return (
          <Group
            key={node.id}
            x={node.x}
            y={node.y}
            draggable
            onClick={(e) => handleNodeClick(node.id, e)}
            onDragStart={(e) => handleDragStart(node.id, e)}
            onDragEnd={(e) => handleDragEnd(node.id, e)}
          >
            <Rect
              width={node.width}
              height={node.height}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <Text
              x={0}
              y={0}
              width={node.width}
              height={node.height}
              text={node.text}
              fontSize={node.fontSize}
              fontFamily={node.fontFamily}
              fontWeight={node.fontWeight}
              fill={node.fill}
              align={node.align}
              verticalAlign={node.verticalAlign}
            />
          </Group>
        );

      case 'button':
        return (
          <Group
            key={node.id}
            x={node.x}
            y={node.y}
            draggable
            onClick={(e) => handleNodeClick(node.id, e)}
            onDragStart={(e) => handleDragStart(node.id, e)}
            onDragEnd={(e) => handleDragEnd(node.id, e)}
          >
            <Rect
              width={node.width}
              height={node.height}
              fill={node.fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              cornerRadius={node.cornerRadius || 8}
            />
            <Text
              x={0}
              y={0}
              width={node.width}
              height={node.height}
              text={node.label}
              fontSize={node.fontSize}
              fontFamily={node.fontFamily}
              fontWeight={node.fontWeight}
              fill={node.textFill}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        );

      case 'image':
        return (
          <Group
            key={node.id}
            x={node.x}
            y={node.y}
            draggable
            onClick={(e) => handleNodeClick(node.id, e)}
            onDragStart={(e) => handleDragStart(node.id, e)}
            onDragEnd={(e) => handleDragEnd(node.id, e)}
          >
            <Rect
              width={node.width}
              height={node.height}
              fill="#f0f0f0"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              cornerRadius={node.cornerRadius || 0}
            />
            <Text
              x={0}
              y={node.height / 2 - 10}
              width={node.width}
              text="Image"
              fontSize={14}
              fill="#666"
              align="center"
            />
          </Group>
        );

      default:
        return null;
    }
  };

  return (
    <div className="canvas-container">
      <Stage
        ref={stageRef}
        width={800}
        height={600}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onClick={handleStageClick}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={doc.width}
            height={doc.height}
            fill="#ffffff"
            stroke="#e0e0e0"
            strokeWidth={1}
          />
          
          {/* Render all nodes */}
          {doc.nodes.map(renderNode)}
        </Layer>
      </Stage>
    </div>
  );
}
