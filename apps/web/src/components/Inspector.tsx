// Inspector panel for editing selected nodes
import React, { useState, useEffect } from 'react';
import { Node, Op } from '@little-chef/dsl';
import { apiClient } from '../lib/api';

interface InspectorProps {
  selectedNodes: Node[];
  docId: string;
  onDocChange: (ops: Op[]) => void;
}

export function Inspector({ selectedNodes, docId, onDocChange }: InspectorProps) {
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  useEffect(() => {
    if (selectedNodes.length === 1) {
      setEditingNode(selectedNodes[0]);
    } else {
      setEditingNode(null);
    }
  }, [selectedNodes]);

  const updateNode = (patch: Partial<Node>) => {
    if (!editingNode) return;

    const op: Op = {
      t: 'update',
      id: editingNode.id,
      patch
    };

    onDocChange([op]);
    apiClient.appendOps(docId, [op]).catch(console.error);
  };

  const deleteNode = () => {
    if (!editingNode) return;

    const op: Op = {
      t: 'remove',
      id: editingNode.id
    };

    onDocChange([op]);
    apiClient.appendOps(docId, [op]).catch(console.error);
  };

  if (!editingNode) {
    return (
      <div className="inspector">
        <h3>Inspector</h3>
        <p>Select a node to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="inspector">
      <h3>Inspector</h3>
      
      <div className="inspector-section">
        <h4>Position & Size</h4>
        <div className="form-group">
          <label>X</label>
          <input
            type="number"
            value={editingNode.x}
            onChange={(e) => updateNode({ x: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="form-group">
          <label>Y</label>
          <input
            type="number"
            value={editingNode.y}
            onChange={(e) => updateNode({ y: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="form-group">
          <label>Width</label>
          <input
            type="number"
            value={editingNode.width}
            onChange={(e) => updateNode({ width: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="form-group">
          <label>Height</label>
          <input
            type="number"
            value={editingNode.height}
            onChange={(e) => updateNode({ height: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>

      {editingNode.type === 'rect' && (
        <div className="inspector-section">
          <h4>Appearance</h4>
          <div className="form-group">
            <label>Fill Color</label>
            <input
              type="color"
              value={editingNode.fill}
              onChange={(e) => updateNode({ fill: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Corner Radius</label>
            <input
              type="number"
              value={editingNode.cornerRadius || 0}
              onChange={(e) => updateNode({ cornerRadius: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}

      {editingNode.type === 'text' && (
        <div className="inspector-section">
          <h4>Text</h4>
          <div className="form-group">
            <label>Text</label>
            <textarea
              value={editingNode.text}
              onChange={(e) => updateNode({ text: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Font Size</label>
            <input
              type="number"
              value={editingNode.fontSize}
              onChange={(e) => updateNode({ fontSize: parseInt(e.target.value) || 12 })}
            />
          </div>
          <div className="form-group">
            <label>Font Family</label>
            <select
              value={editingNode.fontFamily}
              onChange={(e) => updateNode({ fontFamily: e.target.value })}
            >
              <option value="Inter">Inter</option>
              <option value="Onest">Onest</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
            </select>
          </div>
          <div className="form-group">
            <label>Font Weight</label>
            <select
              value={editingNode.fontWeight}
              onChange={(e) => updateNode({ fontWeight: e.target.value })}
            >
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi Bold</option>
              <option value="700">Bold</option>
            </select>
          </div>
          <div className="form-group">
            <label>Text Color</label>
            <input
              type="color"
              value={editingNode.fill}
              onChange={(e) => updateNode({ fill: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Alignment</label>
            <select
              value={editingNode.align}
              onChange={(e) => updateNode({ align: e.target.value as 'left' | 'center' | 'right' })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )}

      {editingNode.type === 'button' && (
        <div className="inspector-section">
          <h4>Button</h4>
          <div className="form-group">
            <label>Label</label>
            <input
              type="text"
              value={editingNode.label}
              onChange={(e) => updateNode({ label: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Background Color</label>
            <input
              type="color"
              value={editingNode.fill}
              onChange={(e) => updateNode({ fill: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Text Color</label>
            <input
              type="color"
              value={editingNode.textFill}
              onChange={(e) => updateNode({ textFill: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Font Size</label>
            <input
              type="number"
              value={editingNode.fontSize}
              onChange={(e) => updateNode({ fontSize: parseInt(e.target.value) || 14 })}
            />
          </div>
          <div className="form-group">
            <label>Corner Radius</label>
            <input
              type="number"
              value={editingNode.cornerRadius || 8}
              onChange={(e) => updateNode({ cornerRadius: parseInt(e.target.value) || 8 })}
            />
          </div>
        </div>
      )}

      <div className="inspector-section">
        <button 
          className="btn btn--orange"
          onClick={deleteNode}
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
