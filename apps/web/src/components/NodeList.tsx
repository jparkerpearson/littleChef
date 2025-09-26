// Node list component for the sidebar
import React, { useState } from 'react';
import { Node, getRootNodes, getChildNodes, Doc } from '@little-chef/dsl';

interface NodeListProps {
    doc: Doc;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function NodeList({ doc, selectedIds, onSelectionChange }: NodeListProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
        const hasChildren = getChildNodes(doc, node.id).length > 0;
        const baseIcon = (() => {
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
        })();

        return hasChildren ? `📦${baseIcon}` : baseIcon;
    };

    const getNodeLabel = (node: Node) => {
        const hasParent = node.parentId;
        const baseLabel = (() => {
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
                    return 'Unknown';
            }
        })();

        return hasParent ? `└ ${baseLabel}` : baseLabel;
    };

    const toggleNodeExpansion = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const renderNode = (node: Node, depth: number = 0): React.ReactNode => {
        const children = getChildNodes(doc, node.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        const indentStyle = { paddingLeft: `${depth * 20}px` };

        return (
            <div key={node.id}>
                <div
                    className={`node-item ${selectedIds.includes(node.id) ? 'selected' : ''} ${hasChildren ? 'has-children' : ''}`}
                    onClick={(e) => handleNodeClick(node.id, e)}
                    style={indentStyle}
                >
                    {hasChildren && (
                        <span
                            className="node-expand-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNodeExpansion(node.id);
                            }}
                        >
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    )}
                    {!hasChildren && <span className="node-expand-spacer">  </span>}
                    <span className="node-icon">{getNodeIcon(node)}</span>
                    <span className="node-label">{getNodeLabel(node)}</span>
                    <span className="node-dimensions">
                        {node.width}×{node.height}
                        {hasChildren && (
                            <span className="child-count">
                                ({children.length})
                                {node.alignment && node.alignment !== 'none' && (
                                    <span className="alignment-info">
                                        {' '}• {node.alignment}
                                    </span>
                                )}
                            </span>
                        )}
                    </span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="node-children">
                        {children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="node-list">
            <div
                className={`node-list-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span>Nodes ({doc.nodes.length})</span>
                <span className="node-list-toggle">
                    ▼
                </span>
            </div>

            {isExpanded && (
                <div className="node-list-content">
                    {doc.nodes.length === 0 ? (
                        <div className="node-list-empty">
                            No nodes yet
                        </div>
                    ) : (
                        getRootNodes(doc).map(node => renderNode(node))
                    )}
                </div>
            )}
        </div>
    );
}
