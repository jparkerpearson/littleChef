// Toolbar component for node creation
import React from 'react';

interface ToolbarProps {
    creationMode: 'none' | 'rect' | 'text' | 'button' | 'image';
    onCreationModeChange: (mode: 'none' | 'rect' | 'text' | 'button' | 'image') => void;
    selectedIds: string[];
    onGroup: () => void;
    onUngroup: () => void;
}

export function Toolbar({ creationMode, onCreationModeChange, selectedIds, onGroup, onUngroup }: ToolbarProps) {
    const tools = [
        { id: 'none', label: 'Select' },
        { id: 'rect', label: 'Frame' },
        { id: 'text', label: 'Text' },
        { id: 'button', label: 'Button' },
        { id: 'image', label: 'Image' },
    ] as const;

    const canGroup = selectedIds.length > 1;
    const canUngroup = selectedIds.length >= 1; // Allow ungrouping any number of nodes

    return (
        <div className="toolbar">
            <div className="toolbar-buttons">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        className={`toolbar-button ${creationMode === tool.id ? 'active' : ''}`}
                        onClick={() => onCreationModeChange(tool.id)}
                        title={tool.label}
                    >
                        {tool.label}
                    </button>
                ))}
            </div>

            <div className="toolbar-separator"></div>

            {/* <div className="toolbar-buttons">
                <button
                    className={`toolbar-button ${!canGroup ? 'disabled' : ''}`}
                    onClick={onGroup}
                    disabled={!canGroup}
                    title="Group selected nodes"
                >
                    📦 Group
                </button>
                <button
                    className={`toolbar-button ${!canUngroup ? 'disabled' : ''}`}
                    onClick={onUngroup}
                    disabled={!canUngroup}
                    title="Ungroup selected node"
                >
                    📤 Ungroup
                </button>
            </div> */}
        </div>
    );
}
