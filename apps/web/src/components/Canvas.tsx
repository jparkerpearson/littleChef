// React-Konva canvas component for Little Chef editor
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle } from 'react-konva';
import { Doc, Node, Op, snapToGrid, createRectNode, createTextNode, createButtonNode, createImageNode, getRootNodes, getChildNodes, getAllDescendants, groupNodes, ungroupNodes, calculateAlignedPositions } from '@little-chef/dsl';
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [rotationHandle, setRotationHandle] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeCurrent, setResizeCurrent] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [creatingNode, setCreatingNode] = useState<{ type: string; startX: number; startY: number } | null>(null);

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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when canvas is focused or no input is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'g' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (selectedIds.length >= 2) {
          handleGroupSelected();
        }
      } else if (event.key === 'u' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (selectedIds.length === 1) {
          const node = doc.nodes.find(n => n.id === selectedIds[0]);
          if (node?.children && node.children.length > 0) {
            handleUngroupNode(selectedIds[0]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, doc]);

  // Handle node selection
  const handleNodeClick = (nodeId: string, event: any) => {
    event.cancelBubble = true;

    if (event.evt.shiftKey) {
      // Multi-select with Shift+click
      if (selectedIds.includes(nodeId)) {
        // If already selected, remove from selection
        onSelectionChange(selectedIds.filter(id => id !== nodeId));
      } else {
        // Add to existing selection
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

  // Handle grouping selected nodes
  const handleGroupSelected = () => {
    if (selectedIds.length < 2) return;

    try {
      const { ops, groupId } = groupNodes(doc, selectedIds);
      onDocChange(ops);
      apiClient.appendOps(doc.id, ops).catch(console.error);
      onSelectionChange([groupId]); // Select the new group
    } catch (error) {
      console.error('Failed to group nodes:', error);
    }
  };

  // Handle ungrouping a node
  const handleUngroupNode = (nodeId: string) => {
    try {
      const ops = ungroupNodes(doc, nodeId);
      onDocChange(ops);
      apiClient.appendOps(doc.id, ops).catch(console.error);
      onSelectionChange([]); // Clear selection after ungrouping
    } catch (error) {
      console.error('Failed to ungroup node:', error);
    }
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

    // Position the menu near the node's top-left corner, accounting for zoom and pan
    const nodeTopLeftX = (node.x + pan.x) * zoom;
    const nodeTopLeftY = (node.y + pan.y) * zoom;

    setContextMenu({
      x: nodeTopLeftX,
      y: nodeTopLeftY,
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
        handleUngroupNode(nodeId);
        break;
      case 'group':
        handleGroupSelected();
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

  // Handle stage mouse down (for initial node creation with drag)
  const handleStageMouseDown = (event: any) => {
    // Only handle left-clicks on empty areas (directly on stage)
    if (event.evt.button === 0 && event.target === stageRef.current && creationMode !== 'none') {
      const stage = event.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      const x = (pointerPosition.x - pan.x) / zoom;
      const y = (pointerPosition.y - pan.y) / zoom;

      setCreatingNode({ type: creationMode, startX: x, startY: y });
    } else if (event.evt.button === 2 && event.target === stageRef.current) {
      event.evt.preventDefault();
      setContextMenu(null); // Close any existing context menu
    }
  };

  // Handle stage mouse move (for initial node creation with drag)
  const handleStageMouseMove = (event: any) => {
    if (!creatingNode) return;

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const x = (pointerPosition.x - pan.x) / zoom;
    const y = (pointerPosition.y - pan.y) / zoom;

    // Update the creating node dimensions
    const width = Math.max(20, Math.abs(x - creatingNode.startX));
    const height = Math.max(20, Math.abs(y - creatingNode.startY));
    const nodeX = Math.min(creatingNode.startX, x);
    const nodeY = Math.min(creatingNode.startY, y);

    // Update the preview (we'll handle this in the render)
    setResizeCurrent({ x: nodeX, y: nodeY, width, height });
  };

  // Handle stage mouse up (for initial node creation with drag)
  const handleStageMouseUp = (event: any) => {
    if (!creatingNode) return;

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const x = (pointerPosition.x - pan.x) / zoom;
    const y = (pointerPosition.y - pan.y) / zoom;

    const width = Math.max(20, Math.abs(x - creatingNode.startX));
    const height = Math.max(20, Math.abs(y - creatingNode.startY));
    const nodeX = snapToGrid(Math.min(creatingNode.startX, x));
    const nodeY = snapToGrid(Math.min(creatingNode.startY, y));
    const nodeWidth = snapToGrid(width);
    const nodeHeight = snapToGrid(height);

    let newNode: Node;
    switch (creatingNode.type) {
      case 'rect':
        newNode = createRectNode({ x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight });
        break;
      case 'text':
        newNode = createTextNode({ x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight });
        break;
      case 'button':
        newNode = createButtonNode({ x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight });
        break;
      case 'image':
        newNode = createImageNode({ x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight });
        break;
      default:
        setCreatingNode(null);
        return;
    }

    const op: Op = { t: 'add', node: newNode };
    onDocChange([op]);
    apiClient.appendOps(doc.id, [op]).catch(console.error);
    onSelectionChange([newNode.id]);
    onCreationModeChange?.('none');
    setCreatingNode(null);
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

    // Get the stage and pointer position
    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    // Calculate position relative to the document (accounting for zoom and pan)
    const pointerX = (pointerPosition.x - pan.x) / zoom;
    const pointerY = (pointerPosition.y - pan.y) / zoom;

    // Calculate the offset from the node's center to where the user clicked
    const offsetX = pointerX - node.x;
    const offsetY = pointerY - node.y;

    // Store the node's current position and the click offset
    setDragStart({ x: node.x, y: node.y });
    setDragCurrent({ x: node.x, y: node.y });
    setDragOffset({ x: offsetX, y: offsetY });
  };

  // Handle drag move
  const handleDragMove = (nodeId: string, event: any) => {
    if (!dragging || draggingNodeId !== nodeId) return;

    // Get the stage and pointer position
    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    // Calculate position relative to the document (accounting for zoom and pan)
    const pointerX = (pointerPosition.x - pan.x) / zoom;
    const pointerY = (pointerPosition.y - pan.y) / zoom;

    // Calculate the new node center position by subtracting the click offset
    const newX = pointerX - dragOffset.x;
    const newY = pointerY - dragOffset.y;

    setDragCurrent({ x: newX, y: newY });
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
    // Node is positioned at its center, so node.x and node.y are the center coordinates
    const nodeCenterX = node.x;
    const nodeCenterY = node.y;

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

  // Handle resize handle drag start
  const handleResizeStart = (nodeId: string, handleType: string, event: any) => {
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setResizeHandle(handleType);
    setResizingNodeId(nodeId);
    setResizeStart({ x: node.x, y: node.y, width: node.width, height: node.height });
    setResizeCurrent({ x: node.x, y: node.y, width: node.width, height: node.height });
  };

  // Handle resize handle drag move
  const handleResizeMove = (nodeId: string, event: any) => {
    if (!resizeHandle) return;

    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const x = (pointerPosition.x - pan.x) / zoom;
    const y = (pointerPosition.y - pan.y) / zoom;

    // Convert from center-based coordinates to top-left based for calculations
    const startTopLeftX = resizeStart.x - resizeStart.width / 2;
    const startTopLeftY = resizeStart.y - resizeStart.height / 2;

    let newTopLeftX = startTopLeftX;
    let newTopLeftY = startTopLeftY;
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;

    // Calculate new dimensions based on handle type
    switch (resizeHandle) {
      case 'nw': // Top-left corner
        newTopLeftX = x;
        newTopLeftY = y;
        newWidth = resizeStart.width + (startTopLeftX - x);
        newHeight = resizeStart.height + (startTopLeftY - y);
        break;
      case 'ne': // Top-right corner
        newTopLeftY = y;
        newWidth = x - startTopLeftX;
        newHeight = resizeStart.height + (startTopLeftY - y);
        break;
      case 'sw': // Bottom-left corner
        newTopLeftX = x;
        newWidth = resizeStart.width + (startTopLeftX - x);
        newHeight = y - startTopLeftY;
        break;
      case 'se': // Bottom-right corner
        newWidth = x - startTopLeftX;
        newHeight = y - startTopLeftY;
        break;
      case 'n': // Top edge
        newTopLeftY = y;
        newHeight = resizeStart.height + (startTopLeftY - y);
        break;
      case 's': // Bottom edge
        newHeight = y - startTopLeftY;
        break;
      case 'w': // Left edge
        newTopLeftX = x;
        newWidth = resizeStart.width + (startTopLeftX - x);
        break;
      case 'e': // Right edge
        newWidth = x - startTopLeftX;
        break;
    }

    // Apply minimum size constraints
    const minSize = 20;
    if (newWidth < minSize) {
      if (resizeHandle.includes('w')) {
        newTopLeftX = startTopLeftX + resizeStart.width - minSize;
      }
      newWidth = minSize;
    }
    if (newHeight < minSize) {
      if (resizeHandle.includes('n')) {
        newTopLeftY = startTopLeftY + resizeStart.height - minSize;
      }
      newHeight = minSize;
    }

    // Convert back to center-based coordinates
    const newCenterX = newTopLeftX + newWidth / 2;
    const newCenterY = newTopLeftY + newHeight / 2;

    setResizeCurrent({ x: newCenterX, y: newCenterY, width: newWidth, height: newHeight });
  };

  // Handle resize handle drag end
  const handleResizeEnd = (nodeId: string, event: any) => {
    if (!resizeHandle) return;

    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Snap to grid
    const newX = snapToGrid(resizeCurrent.x);
    const newY = snapToGrid(resizeCurrent.y);
    const newWidth = snapToGrid(resizeCurrent.width);
    const newHeight = snapToGrid(resizeCurrent.height);

    // Only update if dimensions actually changed
    if (newX !== node.x || newY !== node.y || newWidth !== node.width || newHeight !== node.height) {
      const op: Op = {
        t: 'update',
        id: nodeId,
        patch: { x: newX, y: newY, width: newWidth, height: newHeight }
      };

      onDocChange([op]);
      apiClient.appendOps(doc.id, [op]).catch(console.error);
    }

    setResizeHandle(null);
    setResizingNodeId(null);
  };

  // Render a node and all its descendants within a Group
  const renderNodeWithChildren = (node: Node, parentOffset: { x: number; y: number } = { x: 0, y: 0 }): React.ReactNode => {
    const children = getChildNodes(doc, node.id);

    if (children.length === 0) {
      // No children, just render the node directly at its position relative to parent
      return renderNode({ ...node, x: node.x + parentOffset.x, y: node.y + parentOffset.y });
    }

    // Apply alignment if specified
    const alignment = node.alignment || 'none';
    let alignedChildren = children;

    if (alignment !== 'none') {
      const alignedPositions = calculateAlignedPositions(node, children, alignment);
      alignedChildren = children.map((child, index) => ({
        ...child,
        x: alignedPositions[index].x,
        y: alignedPositions[index].y
      }));
    }

    // Calculate the node's absolute position
    const nodeAbsoluteX = node.x + parentOffset.x;
    const nodeAbsoluteY = node.y + parentOffset.y;

    // Render children inside the parent node with relative positioning
    return (
      <Group key={`group-${node.id}`} x={nodeAbsoluteX} y={nodeAbsoluteY}>
        {/* Render the parent node at (0,0) relative to the group */}
        {renderNode({ ...node, x: 0, y: 0 })}
        {alignedChildren.map((child: Node) => {
          // Child nodes are positioned relative to this node's top-left corner (0,0 in the group)
          return renderNodeWithChildren(child, { x: 0, y: 0 });
        })}
      </Group>
    );
  };

  // Render hierarchical nodes recursively
  const renderHierarchicalNode = (node: Node, parentOffset: { x: number; y: number } = { x: 0, y: 0 }): React.ReactNode => {
    return renderNodeWithChildren(node, parentOffset);
  };

  // Render different node types
  const renderNode = (node: Node) => {
    const isSelected = selectedIds.includes(node.id);
    const isDragging = draggingNodeId === node.id;
    const isResizing = resizeHandle && resizingNodeId === node.id;
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
              x={node.x}
              y={node.y}
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
              x={node.x}
              y={node.y}
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
              x={node.x}
              y={node.y}
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
              x={node.x}
              y={node.y}
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

    // Add rotation handle and resize handles for selected nodes
    if (isSelected) {
      const handleSize = 8;
      const handleOffset = handleSize / 2;

      return (
        <Group key={`${node.id}-selection`}>
          {nodeElement}
          {/* Rotation handle */}
          <Circle
            x={node.x}
            y={node.y - node.height / 2 - 20}
            radius={6}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={2}
            draggable
            onDragMove={(e) => handleRotationDrag(node.id, e)}
            onDragEnd={handleRotationDragEnd}
          />

          {/* Resize handles */}
          {/* Corner handles */}
          <Rect
            x={node.x - node.width / 2 - handleOffset}
            y={node.y - node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'nw', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x + node.width / 2 - handleOffset}
            y={node.y - node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'ne', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x - node.width / 2 - handleOffset}
            y={node.y + node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'sw', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x + node.width / 2 - handleOffset}
            y={node.y + node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'se', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />

          {/* Edge handles */}
          <Rect
            x={node.x - handleOffset}
            y={node.y - node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'n', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x - handleOffset}
            y={node.y + node.height / 2 - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 's', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x - node.width / 2 - handleOffset}
            y={node.y - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'w', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
          />
          <Rect
            x={node.x + node.width / 2 - handleOffset}
            y={node.y - handleOffset}
            width={handleSize}
            height={handleSize}
            fill="#4c93af"
            stroke="#ffffff"
            strokeWidth={1}
            draggable
            onDragStart={(e) => handleResizeStart(node.id, 'e', e)}
            onDragMove={(e) => handleResizeMove(node.id, e)}
            onDragEnd={(e) => handleResizeEnd(node.id, e)}
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
            x={snappedX}
            y={snappedY}
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

    // Add preview rectangle when resizing
    if (isResizing) {
      const snappedX = snapToGrid(resizeCurrent.x);
      const snappedY = snapToGrid(resizeCurrent.y);
      const snappedWidth = snapToGrid(resizeCurrent.width);
      const snappedHeight = snapToGrid(resizeCurrent.height);

      return (
        <Group key={`${node.id}-resizing`}>
          {nodeElement}
          <Rect
            x={snappedX}
            y={snappedY}
            width={snappedWidth}
            height={snappedHeight}
            fill="transparent"
            stroke="#4c93af"
            strokeWidth={2}
            cornerRadius={node.type === 'rect' ? node.cornerRadius || 0 : 0}
            offsetX={snappedWidth / 2}
            offsetY={snappedHeight / 2}
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
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          console.log("Right click on canvas blocked");
        }}
      >
        <Layer>
          {/* Canvas background - large enough to cover zoom/pan area */}
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill="#f8f9fa"
          />
          {/* Render hierarchical nodes */}
          {getRootNodes(doc).map(node => renderHierarchicalNode(node))}

          {/* Render preview for initial node creation */}
          {creatingNode && (
            <Rect
              x={resizeCurrent.x}
              y={resizeCurrent.y}
              width={resizeCurrent.width}
              height={resizeCurrent.height}
              fill="transparent"
              stroke="#4c93af"
              strokeWidth={2}
              cornerRadius={creatingNode.type === 'rect' ? 8 : 0}
              offsetX={resizeCurrent.width / 2}
              offsetY={resizeCurrent.height / 2}
              dash={[5, 5]}
              opacity={0.8}
            />
          )}
        </Layer>

      </Stage>

      {/* Context Menu */}
      {
        contextMenu && (() => {
          const node = doc.nodes.find(n => n.id === contextMenu.nodeId);
          const hasParent = node && 'parentId' in node && node.parentId;
          const isGroup = node && node.children && node.children.length > 0;
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
                {isGroup && (
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
                    📦 Group Selected ({selectedIds.length})
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

      {/* Multi-selection info */}
      {selectedIds.length > 1 && (
        <div
          className="multi-selection-info"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(76, 147, 175, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          {selectedIds.length} nodes selected
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
            Ctrl+G to group • Ctrl+U to ungroup
          </div>
        </div>
      )}

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
