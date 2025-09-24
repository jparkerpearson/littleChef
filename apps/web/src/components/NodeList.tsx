// Node list component for the sidebar
import React, { useState } from 'react';
import { Node } from '@little-chef/dsl';

interface NodeListProps {
    nodes: Node[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function NodeList({ nodes, selectedIds, onSelectionChange }: NodeListProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleNodeClick = (nodeId: string, event: React.MouseEvent) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
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

    const getNodeIcon = (node: Node) => {
        switch (node.type) {
            case 'rect':
                return '⬜';
            case 'text':
                return '📝';
            case 'button':
                return '🔘';
            case 'image':
                return '🖼️';
            default:
                return '📦';
        }
    };

    const getNodeLabel = (node: Node) => {
        switch (node.type) {
            case 'text':
                return node.text || 'Text';
            case 'button':
                return node.label || 'Button';
            case 'image':
                return 'Image';
            case 'rect':
                return 'Rectangle';
            default:
                return node.type;
        }
    };

    return (
        <div className="node-list">
            <div
                className="node-list-header"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: '#f8f9fa',
                    fontWeight: '600',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span>Nodes ({nodes.length})</span>
                <span style={{ fontSize: '12px' }}>
                    {isExpanded ? '▼' : '▶'}
                </span>
            </div>

            {isExpanded && (
                <div className="node-list-content" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {nodes.length === 0 ? (
                        <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                            No nodes yet
                        </div>
                    ) : (
                        nodes.map((node) => (
                            <div
                                key={node.id}
                                onClick={(e) => handleNodeClick(node.id, e)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f0f0f0',
                                    backgroundColor: selectedIds.includes(node.id) ? '#e3f2fd' : 'transparent',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = selectedIds.includes(node.id) ? '#bbdefb' : '#f5f5f5';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = selectedIds.includes(node.id) ? '#e3f2fd' : 'transparent';
                                }}
                            >
                                <span style={{ fontSize: '16px' }}>{getNodeIcon(node)}</span>
                                <span style={{ flex: 1 }}>{getNodeLabel(node)}</span>
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    {node.width}×{node.height}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
