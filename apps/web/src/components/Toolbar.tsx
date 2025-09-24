// Toolbar component for node creation
import React from 'react';

interface ToolbarProps {
    creationMode: 'none' | 'rect' | 'text' | 'button' | 'image';
    onCreationModeChange: (mode: 'none' | 'rect' | 'text' | 'button' | 'image') => void;
}

export function Toolbar({ creationMode, onCreationModeChange }: ToolbarProps) {
    const tools = [
        { id: 'none', label: 'Select' },
        { id: 'rect', label: 'Rectangle' },
        { id: 'text', label: 'Text' },
        { id: 'button', label: 'Button' },
        { id: 'image', label: 'Image' },
    ] as const;

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
        </div>
    );
}
