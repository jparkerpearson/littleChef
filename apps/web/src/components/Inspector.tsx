// Inspector panel for editing selected nodes
import React, { useState, useEffect } from 'react';
import { Node, Op, getChildNodes, getAllDescendants, Doc, applyAlignmentToChildren } from '@little-chef/dsl';
import { apiClient } from '../lib/api';

interface InspectorProps {
  selectedNodes: Node[];
  docId: string;
  doc: Doc;
  onDocChange: (ops: Op[]) => void;
}

export function Inspector({ selectedNodes, docId, doc, onDocChange }: InspectorProps) {
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

  // Get children and descendants for grouped nodes
  const children = editingNode ? getChildNodes(doc, editingNode.id) : [];
  const allDescendants = editingNode ? getAllDescendants(doc, editingNode.id) : [];
  const hasChildren = children.length > 0;

  return (
    <div className="inspector">
      <h3>Inspector</h3>

      {hasChildren && (
        <div className="inspector-section">
          <h4>Group Information</h4>
          <div className="form-group">
            <label>Direct Children</label>
            <div className="children-list">
              {children.map(child => (
                <div key={child.id} className="child-item">
                  <span className="child-icon">
                    {child.type === 'rect' ? '▢' :
                      child.type === 'text' ? 'T' :
                        child.type === 'button' ? 'B' :
                          child.type === 'image' ? '🖼' : '?'}
                  </span>
                  <span className="child-label">
                    {child.type === 'text' ? child.text || 'Text' :
                      child.type === 'button' ? child.label || 'Button' :
                        child.type === 'image' ? 'Image' :
                          child.type === 'rect' ? 'Rectangle' : 'Unknown'}
                  </span>
                  <span className="child-dimensions">{child.width}×{child.height}</span>
                </div>
              ))}
            </div>
          </div>
          {allDescendants.length > children.length && (
            <div className="form-group">
              <label>Total Descendants</label>
              <span className="descendant-count">{allDescendants.length} nodes</span>
            </div>
          )}

          <div className="form-group">
            <label>Child Alignment</label>
            <select
              value={editingNode.alignment || 'none'}
              onChange={(e) => {
                const alignment = e.target.value as 'none' | 'horizontal' | 'vertical' | 'grid';
                updateNode({ alignment });

                // Apply alignment to children if not 'none'
                if (alignment !== 'none') {
                  const alignmentOps = applyAlignmentToChildren(doc, editingNode.id);
                  if (alignmentOps.length > 0) {
                    onDocChange(alignmentOps);
                    apiClient.appendOps(docId, alignmentOps).catch(console.error);
                  }
                }
              }}
            >
              <option value="none">None (Manual positioning)</option>
              <option value="horizontal">Horizontal (Row)</option>
              <option value="vertical">Vertical (Column)</option>
              <option value="grid">Grid</option>
            </select>
            <div className="form-help">
              {editingNode.alignment === 'none' && 'Children maintain their current positions'}
              {editingNode.alignment === 'horizontal' && 'Children are arranged in a horizontal row'}
              {editingNode.alignment === 'vertical' && 'Children are arranged in a vertical column'}
              {editingNode.alignment === 'grid' && 'Children are arranged in a grid layout'}
            </div>
          </div>
        </div>
      )}

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
