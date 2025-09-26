// React-Konva canvas component for Little Chef editor
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle } from 'react-konva';
import { Doc, Node, Op, snapToGrid, createRectNode, createTextNode, createButtonNode, createImageNode, getRootNodes, getChildNodes, getAllDescendants } from '@little-chef/dsl';
import { apiClient } from '../lib/api';

interface CanvasProps {
  doc: Doc;
  onDocChange: (ops: Op[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  zoom: number;
  pan: { x: number; y: number };
  creationMode?: 'none' | 'rect' | 'text' | 'button' | 'image';
  onCreationModeChange?: (mode: 'none' | 'rect' | 'text' | 'button' | 'image') => void;
}

export function Canvas({ doc, onDocChange, selectedIds, onSelectionChange, zoom, pan, creationMode = 'none', onCreationModeChange }: CanvasProps) {
  const stageRef = useRef<any>(null);
  const [dragging, setDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });
  const [rotationHandle, setRotationHandle] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Handle window resize
  useEffect(() => {
    const updateCanvasSize = () => {
      let sidebarWidth = 0;
      let gapWidth = 0;

      if (window.innerWidth <= 900) {
        // Mobile: single column layout
        sidebarWidth = 0;
        gapWidth = 0;
      } else if (window.innerWidth <= 1200) {
        // Tablet: 250px sidebars
        sidebarWidth = 500; // 250px + 250px
        gapWidth = 40; // 20px gap between each column
      } else {
        // Desktop: 300px sidebars
        sidebarWidth = 600; // 300px + 300px
        gapWidth = 40; // 20px gap between each column
      }

      const width = Math.max(400, window.innerWidth - sidebarWidth - gapWidth - 80); // Subtract sidebars, gaps, padding (20px each side), and right margin (20px)
      const height = Math.max(300, window.innerHeight - 140); // Subtract navbar height + padding, min 300px
      setCanvasSize({ width, height });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

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

  // Handle double-click for text editing
  const handleNodeDoubleClick = (nodeId: string, event: any) => {
    event.cancelBubble = true;
    const node = doc.nodes.find(n => n.id === nodeId);
    if (node && node.type === 'text') {
      setEditingText(nodeId);
    }
  };

  // Handle text editing
  const handleTextEdit = (nodeId: string, newText: string) => {
    const op: Op = {
      t: 'update',
      id: nodeId,
      patch: { text: newText }
    };
    onDocChange([op]);
    apiClient.appendOps(doc.id, [op]).catch(console.error);
    setEditingText(null);
  };

  // Handle right-click context menu
  const handleNodeRightClick = (nodeId: string, event: any) => {
    event.cancelBubble = true;
    event.evt.preventDefault();
    event.evt.stopPropagation();

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    // Get the node to position the menu closer to it
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Position the menu near the node's center, accounting for zoom and pan
    const nodeCenterX = (node.x + node.width / 2 + pan.x) * zoom;
    const nodeCenterY = (node.y + node.height / 2 + pan.y) * zoom;

    setContextMenu({
      x: nodeCenterX,
      y: nodeCenterY,
      nodeId
    });
  };

  // Handle context menu actions
  const handleContextMenuAction = (action: string, nodeId: string) => {
    setContextMenu(null);

    switch (action) {
      case 'delete':
        const op: Op = { t: 'remove', id: nodeId };
        onDocChange([op]);
        apiClient.appendOps(doc.id, [op]).catch(console.error);
        onSelectionChange(selectedIds.filter(id => id !== nodeId));
        break;
      case 'duplicate':
        const duplicateNode = doc.nodes.find(n => n.id === nodeId);
        if (duplicateNode) {
          const newNode = { ...duplicateNode, id: Math.random().toString(36).substr(2, 9), x: duplicateNode.x + 20, y: duplicateNode.y + 20 };
          const duplicateOp: Op = { t: 'add', node: newNode };
          onDocChange([duplicateOp]);
          apiClient.appendOps(doc.id, [duplicateOp]).catch(console.error);
          onSelectionChange([newNode.id]);
        }
        break;
      case 'ungroup':
        // Remove parent relationship for this node
        const ungroupNode = doc.nodes.find(n => n.id === nodeId);
        const ops: Op[] = [];

        // Remove parentId from the node
        ops.push({ t: 'reparent', id: nodeId, parentId: null });

        // Remove this node from parent's children array
        if (ungroupNode?.parentId) {
          const parentNode = doc.nodes.find(n => n.id === ungroupNode.parentId);
          if (parentNode?.children) {
            const updatedChildren = parentNode.children.filter(id => id !== nodeId);
            ops.push({ t: 'update', id: ungroupNode.parentId, patch: { children: updatedChildren } });
          }
        }

        onDocChange(ops);
        apiClient.appendOps(doc.id, ops).catch(console.error);
        break;
      case 'group':
        // Group selected nodes under this node
        if (selectedIds.length > 1) {
          const ops: Op[] = [];
          const childIds: string[] = [];

          selectedIds.forEach(id => {
            if (id !== nodeId) {
              ops.push({ t: 'reparent', id, parentId: nodeId });
              childIds.push(id);
            }
          });

          // Add children to parent node
          if (childIds.length > 0) {
            const parentNode = doc.nodes.find(n => n.id === nodeId);
            const existingChildren = parentNode?.children || [];
            const newChildren = [...existingChildren, ...childIds];
            ops.push({ t: 'update', id: nodeId, patch: { children: newChildren } });
          }

          onDocChange(ops);
          apiClient.appendOps(doc.id, ops).catch(console.error);
        }
        break;
    }
  };

  // Handle stage click (deselect or create node)
  const handleStageClick = (event: any) => {
    // Check if the click was directly on the Stage (not on any child nodes)
    console.log('Target', event.target);
    console.log('Stage', stageRef.current);
    console.log('Target equals stage', event.target === stageRef.current);
    console.log('Event cancelled', event.cancelBubble);

    // Only handle stage clicks if the event wasn't cancelled by child nodes
    if (!event.cancelBubble) {
      setContextMenu(null); // Close context menu
      setEditingText(null); // Close text editing
      if (creationMode !== 'none') {
        console.log('Creating node', creationMode);
        // Create a new node at the clicked position
        const stage = event.target.getStage();
        const pointerPosition = stage.getPointerPosition();

        // Calculate position relative to the document
        const x = snapToGrid((pointerPosition.x - pan.x) / zoom);
        const y = snapToGrid((pointerPosition.y - pan.y) / zoom);

        console.log('Creating node at:', { x, y, creationMode, pointerPosition, pan, zoom });

        let newNode: Node;
        switch (creationMode) {
          case 'rect':
            newNode = createRectNode({ x, y });
            break;
          case 'text':
            newNode = createTextNode({ x, y });
            break;
          case 'button':
            newNode = createButtonNode({ x, y });
            break;
          case 'image':
            newNode = createImageNode({ x, y });
            break;
          default:
            return;
        }

        console.log('Created node:', newNode);

        const op: Op = { t: 'add', node: newNode };
        onDocChange([op]);
        apiClient.appendOps(doc.id, [op]).catch(console.error);
        onSelectionChange([newNode.id]);
        onCreationModeChange?.('none');
      } else {
        onSelectionChange([]);
      }
    }
  };

  // Handle stage mouse down (for right-click prevention on empty areas)
  const handleStageMouseDown = (event: any) => {
    // Only handle right-clicks on empty areas (directly on stage)
    if (event.evt.button === 2 && event.target === stageRef.current) {
      event.evt.preventDefault();
      setContextMenu(null); // Close any existing context menu
    }
  };

  // Handle drag start
  const handleDragStart = (nodeId: string, event: any) => {
    // Prevent multiple drag operations
    if (dragging) return;

    // Select the node if it's not already selected
    if (!selectedIds.includes(nodeId)) {
      onSelectionChange([nodeId]);
    }

    setDragging(true);
    setDraggingNodeId(nodeId);

    // Get the node to access its dimensions
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) {
      setDragging(false);
      setDraggingNodeId(null);
      return;
    }

    // Use the node's current position as the drag start position
    const topLeftX = node.x;
    const topLeftY = node.y;

    setDragStart({ x: topLeftX, y: topLeftY });
    setDragCurrent({ x: topLeftX, y: topLeftY });
  };

  // Handle drag move
  const handleDragMove = (nodeId: string, event: any) => {
    if (!dragging || draggingNodeId !== nodeId) return;

    // Get the node to access its dimensions
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Get the stage and pointer position
    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    // Calculate position relative to the document (accounting for zoom and pan)
    const x = (pointerPosition.x - pan.x) / zoom;
    const y = (pointerPosition.y - pan.y) / zoom;

    setDragCurrent({ x, y });
  };

  // Handle drag end
  const handleDragEnd = (nodeId: string, event: any) => {
    if (!dragging || draggingNodeId !== nodeId) {
      setDragging(false);
      setDraggingNodeId(null);
      return;
    }

    // Get the node to access its dimensions
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) {
      setDragging(false);
      setDraggingNodeId(null);
      return;
    }

    // Snap the current drag position to grid
    const newX = snapToGrid(dragCurrent.x);
    const newY = snapToGrid(dragCurrent.y);

    // Only update if position actually changed
    if (newX !== dragStart.x || newY !== dragStart.y) {
      const deltaX = newX - dragStart.x;
      const deltaY = newY - dragStart.y;

      const ops: Op[] = [];

      // Update the dragged node
      ops.push({
        t: 'update',
        id: nodeId,
        patch: { x: newX, y: newY }
      });

      // Update all descendant nodes with the same delta
      const descendants = getAllDescendants(doc, nodeId);
      descendants.forEach((descendant: Node) => {
        ops.push({
          t: 'update',
          id: descendant.id,
          patch: {
            x: descendant.x + deltaX,
            y: descendant.y + deltaY
          }
        });
      });

      // Send operations to parent
      onDocChange(ops);

      // Send to server
      apiClient.appendOps(doc.id, ops).catch(console.error);
    }

    setDragging(false);
    setDraggingNodeId(null);
  };

  // Handle rotation handle drag
  const handleRotationDrag = (nodeId: string, event: any) => {
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;

    const angle = Math.atan2(
      (pointerPosition.y - pan.y) / zoom - nodeCenterY,
      (pointerPosition.x - pan.x) / zoom - nodeCenterX
    );

    const rotation = (angle * 180) / Math.PI;

    const op: Op = {
      t: 'update',
      id: nodeId,
      patch: { rotation }
    };

    onDocChange([op]);
    apiClient.appendOps(doc.id, [op]).catch(console.error);
  };

  // Handle rotation handle drag end
  const handleRotationDragEnd = () => {
    setRotationHandle(null);
  };

  // Render hierarchical nodes recursively
  const renderHierarchicalNode = (node: Node): React.ReactNode => {
    const children = getChildNodes(doc, node.id);
    const nodeElement = renderNode(node);

    if (children.length === 0) {
      return nodeElement;
    }

    // Render children inside the parent node
    return (
      <Group key={`group-${node.id}`}>
        {nodeElement}
        {children.map((child: Node) => renderHierarchicalNode(child))}
      </Group>
    );
  };

  // Render different node types
  const renderNode = (node: Node) => {
    const isSelected = selectedIds.includes(node.id);
    const isDragging = draggingNodeId === node.id;
    const strokeColor = isSelected ? '#4c93af' : ('stroke' in node ? node.stroke : undefined) || 'transparent';
    const strokeWidth = isSelected ? 2 : ('strokeWidth' in node ? node.strokeWidth : undefined) || 0;
    const rotation = ('rotation' in node ? node.rotation : undefined) || 0;

    // Calculate opacity for dragging effect
    const opacity = isDragging ? 0.5 : 1;

    const nodeElement = (() => {
      switch (node.type) {
        case 'rect':
          return (
            <Rect
              key={node.id}
              x={node.x + node.width / 2}
              y={node.y + node.height / 2}
              width={node.width}
              height={node.height}
              fill={node.fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              cornerRadius={node.cornerRadius || 0}
              rotation={rotation}
              offsetX={node.width / 2}
              offsetY={node.height / 2}
              opacity={opacity}
              draggable
              onClick={(e) => handleNodeClick(node.id, e)}
              onTap={(e) => handleNodeClick(node.id, e)}
              onDblClick={(e) => handleNodeDoubleClick(node.id, e)}
              onMouseDown={(e) => {
                if (e.evt.button === 2) { // Right click
                  handleNodeRightClick(node.id, e);
                }
              }}
              onDragStart={(e) => handleDragStart(node.id, e)}
              onDragMove={(e) => handleDragMove(node.id, e)}
              onDragEnd={(e) => handleDragEnd(node.id, e)}
            />
          );

        case 'text':
          return (
            <Group
              key={node.id}
              x={node.x + node.width / 2}
              y={node.y + node.height / 2}
              rotation={rotation}
              offsetX={node.width / 2}
              offsetY={node.height / 2}
              opacity={opacity}
              draggable
              onClick={(e) => handleNodeClick(node.id, e)}
              onTap={(e) => handleNodeClick(node.id, e)}
              onDblClick={(e) => handleNodeDoubleClick(node.id, e)}
              onMouseDown={(e) => {
                if (e.evt.button === 2) { // Right click
                  handleNodeRightClick(node.id, e);
                }
              }}
              onDragStart={(e) => handleDragStart(node.id, e)}
              onDragMove={(e) => handleDragMove(node.id, e)}
              onDragEnd={(e) => handleDragEnd(node.id, e)}
            >
              <Rect
                x={-node.width / 2}
                y={-node.height / 2}
                width={node.width}
                height={node.height}
                fill="transparent"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <Text
                x={-node.width / 2}
                y={-node.height / 2}
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
              x={node.x + node.width / 2}
              y={node.y + node.height / 2}
              rotation={rotation}
              offsetX={node.width / 2}
              offsetY={node.height / 2}
              opacity={opacity}
              draggable
              onClick={(e) => handleNodeClick(node.id, e)}
              onTap={(e) => handleNodeClick(node.id, e)}
              onDblClick={(e) => handleNodeDoubleClick(node.id, e)}
              onMouseDown={(e) => {
                if (e.evt.button === 2) { // Right click
                  handleNodeRightClick(node.id, e);
                }
              }}
              onDragStart={(e) => handleDragStart(node.id, e)}
              onDragMove={(e) => handleDragMove(node.id, e)}
              onDragEnd={(e) => handleDragEnd(node.id, e)}
            >
              <Rect
                x={-node.width / 2}
                y={-node.height / 2}
                width={node.width}
                height={node.height}
                fill={node.fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                cornerRadius={node.cornerRadius || 8}
              />
              <Text
                x={-node.width / 2}
                y={-node.height / 2}
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
              x={node.x + node.width / 2}
              y={node.y + node.height / 2}
              rotation={rotation}
              offsetX={node.width / 2}
              offsetY={node.height / 2}
              opacity={opacity}
              draggable
              onClick={(e) => handleNodeClick(node.id, e)}
              onTap={(e) => handleNodeClick(node.id, e)}
              onDblClick={(e) => handleNodeDoubleClick(node.id, e)}
              onMouseDown={(e) => {
                if (e.evt.button === 2) { // Right click
                  handleNodeRightClick(node.id, e);
                }
              }}
              onDragStart={(e) => handleDragStart(node.id, e)}
              onDragMove={(e) => handleDragMove(node.id, e)}
              onDragEnd={(e) => handleDragEnd(node.id, e)}
            >
              <Rect
                x={-node.width / 2}
                y={-node.height / 2}
                width={node.width}
                height={node.height}
                fill="#f0f0f0"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                cornerRadius={node.cornerRadius || 0}
              />
              <Text
                x={-node.width / 2}
                y={-10}
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
    })();

    // Add rotation handle for selected nodes
    if (isSelected) {
      return (
        <Group key={`${node.id}-selection`}>
          {nodeElement}
          <Circle
            x={node.x + node.width / 2}
            y={node.y - 20}
            radius={6}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={2}
            draggable
            onDragMove={(e) => handleRotationDrag(node.id, e)}
            onDragEnd={handleRotationDragEnd}
          />
        </Group>
      );
    }

    // Add preview rectangle when dragging
    if (isDragging) {
      const snappedX = snapToGrid(dragCurrent.x);
      const snappedY = snapToGrid(dragCurrent.y);

      return (
        <Group key={`${node.id}-dragging`}>
          {nodeElement}
          <Rect
            x={snappedX + node.width / 2}
            y={snappedY + node.height / 2}
            width={node.width}
            height={node.height}
            fill="transparent"
            stroke="#4c93af"
            strokeWidth={2}
            cornerRadius={node.type === 'rect' ? node.cornerRadius || 0 : 0}
            offsetX={node.width / 2}
            offsetY={node.height / 2}
            dash={[5, 5]}
            opacity={0.8}
          />
        </Group>
      );
    }

    return nodeElement;
  };

  return (
    <div className="canvas-container" style={{ width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={canvasSize.width}
        height={canvasSize.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          console.log("Right click on canvas blocked");
        }}
      >
        <Layer>
          {/* Render hierarchical nodes */}
          {getRootNodes(doc).map(node => renderHierarchicalNode(node))}
        </Layer>

      </Stage>

      {/* Context Menu */}
      {
        contextMenu && (() => {
          const node = doc.nodes.find(n => n.id === contextMenu.nodeId);
          const hasParent = node && 'parentId' in node && node.parentId;
          const canGroup = selectedIds.length > 1 && selectedIds.includes(contextMenu.nodeId);

          return (
            <div
              className="context-menu"
              style={{
                position: 'absolute',
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 1000,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                console.log("Right-click blocked!");
              }}
            >
              <div className="context-menu-content">
                <button
                  className="context-menu-item"
                  onClick={() => handleContextMenuAction('duplicate', contextMenu.nodeId)}
                >
                  📋 Duplicate
                </button>
                {hasParent && (
                  <button
                    className="context-menu-item"
                    onClick={() => handleContextMenuAction('ungroup', contextMenu.nodeId)}
                  >
                    📦 Ungroup
                  </button>
                )}
                {canGroup && (
                  <button
                    className="context-menu-item"
                    onClick={() => handleContextMenuAction('group', contextMenu.nodeId)}
                  >
                    📦 Group
                  </button>
                )}
                <button
                  className="context-menu-item"
                  onClick={() => handleContextMenuAction('delete', contextMenu.nodeId)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })()
      }

      {/* Text Editing Overlay */}
      {
        editingText && (() => {
          const node = doc.nodes.find(n => n.id === editingText);
          if (!node || node.type !== 'text') return null;

          return (
            <div
              className="text-edit-overlay"
              style={{
                position: 'absolute',
                left: (node.x + pan.x) * zoom,
                top: (node.y + pan.y) * zoom,
                width: node.width * zoom,
                height: node.height * zoom,
                zIndex: 1001,
              }}
            >
              <textarea
                className="text-edit-input"
                value={node.text}
                onChange={(e) => {
                  const op: Op = {
                    t: 'update',
                    id: node.id,
                    patch: { text: e.target.value }
                  };
                  onDocChange([op]);
                  apiClient.appendOps(doc.id, [op]).catch(console.error);
                }}
                onBlur={() => setEditingText(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setEditingText(null);
                  }
                  if (e.key === 'Escape') {
                    setEditingText(null);
                  }
                }}
                autoFocus
                style={{
                  width: '100%',
                  height: '100%',
                  border: '2px solid var(--brand-teal)',
                  borderRadius: '4px',
                  padding: '4px',
                  fontSize: `${node.fontSize * zoom}px`,
                  fontFamily: node.fontFamily,
                  fontWeight: node.fontWeight,
                  color: node.fill,
                  background: 'rgba(255, 255, 255, 0.95)',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
          );
        })()
      }
    </div >
  );
}
