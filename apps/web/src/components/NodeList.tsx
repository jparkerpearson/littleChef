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
                return '▢';
            case 'text':
                return 'T';
            case 'button':
                return 'B';
            case 'image':
                return '🖼';
            default:
                return '?';
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
                className={`node-list-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span>Nodes ({nodes.length})</span>
                <span className="node-list-toggle">
                    ▼
                </span>
            </div>

            {isExpanded && (
                <div className="node-list-content">
                    {nodes.length === 0 ? (
                        <div className="node-list-empty">
                            No nodes yet
                        </div>
                    ) : (
                        nodes.map((node) => (
                            <div
                                key={node.id}
                                className={`node-item ${selectedIds.includes(node.id) ? 'selected' : ''}`}
                                onClick={(e) => handleNodeClick(node.id, e)}
                            >
                                <span className="node-icon">{getNodeIcon(node)}</span>
                                <span className="node-label">{getNodeLabel(node)}</span>
                                <span className="node-dimensions">
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
