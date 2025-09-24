// Document editor page
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Doc, Op, applyOps } from '@little-chef/dsl';
import { apiClient } from '../../lib/api';
import { Canvas } from '../../components/CanvasWrapper';
import { Inspector } from '../../components/Inspector';
import { PromptBox } from '../../components/PromptBox';

export default function DocumentEditor() {
  const router = useRouter();
  const { id } = router.query;
  
  const [doc, setDoc] = useState<Doc | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom] = useState(1);
  const [pan] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const undoStack = useRef<Doc[]>([]);
  const redoStack = useRef<Doc[]>([]);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    loadDocument(id);
    connectWebSocket(id);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id]);

  const loadDocument = async (docId: string) => {
    try {
      const response = await apiClient.fetchDoc(docId);
      setDoc(response.snapshot);
      
      // Apply any operations since the snapshot
      if (response.opsSince.length > 0) {
        const updatedDoc = applyOps(response.snapshot, response.opsSince);
        setDoc(updatedDoc);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      setError('Failed to load document');
    }
  };

  const connectWebSocket = (docId: string) => {
    wsRef.current = apiClient.connectWS(docId, (message) => {
      if (message.type === 'hello') {
        console.log('Connected to document:', message.version);
        setCollaborators(1); // We're connected
      } else if (message.type === 'ops') {
        // Apply incoming operations
        if (doc) {
          const updatedDoc = applyOps(doc, message.ops);
          setDoc(updatedDoc);
          
          // Update collaborator count (rough estimate)
          setCollaborators(prev => Math.max(prev, 2));
        }
      }
    });
  };

  const handleDocChange = (ops: Op[]) => {
    if (!doc) return;

    // Save current state for undo
    undoStack.current.push(doc);
    if (undoStack.current.length > 50) {
      undoStack.current.shift(); // Keep only last 50 states
    }
    redoStack.current = []; // Clear redo stack

    // Apply operations
    const updatedDoc = applyOps(doc, ops);
    setDoc(updatedDoc);
  };

  const handleGenerate = (ops: Op[]) => {
    handleDocChange(ops);
  };

  const handleGenerateError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!doc) return;

    if (e.key === 'Delete' && selectedIds.length > 0) {
      // Delete selected nodes
      const ops: Op[] = selectedIds.map(id => ({ t: 'remove', id }));
      handleDocChange(ops);
      apiClient.appendOps(doc.id, ops).catch(console.error);
      setSelectedIds([]);
    }

    // Arrow key movement
    if (selectedIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 8 : 1;
      const delta = { x: 0, y: 0 };
      
      switch (e.key) {
        case 'ArrowUp': delta.y = -step; break;
        case 'ArrowDown': delta.y = step; break;
        case 'ArrowLeft': delta.x = -step; break;
        case 'ArrowRight': delta.x = step; break;
      }

      const ops: Op[] = selectedIds.map(id => ({
        t: 'update',
        id,
        patch: { x: doc.nodes.find(n => n.id === id)!.x + delta.x, y: doc.nodes.find(n => n.id === id)!.y + delta.y }
      }));

      handleDocChange(ops);
      apiClient.appendOps(doc.id, ops).catch(console.error);
    }

    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;
    
    const previousDoc = undoStack.current.pop()!;
    redoStack.current.push(doc!);
    setDoc(previousDoc);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    
    const nextDoc = redoStack.current.pop()!;
    undoStack.current.push(doc!);
    setDoc(nextDoc);
  };

  if (!doc) {
    return (
      <div className="container">
        <div className="hero">
          <div className="hero-inner">
            <div>
              <h1 className="display">Loading...</h1>
              <p className="lead">Loading your document...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedNodes = doc.nodes.filter(node => selectedIds.includes(node.id));

  return (
    <div className="editor-layout" onKeyDown={handleKeyDown} tabIndex={0}>
      <nav className="navbar">
        <div className="nav-inner">
          <div className="brand">Little Chef</div>
          <div className="nav-spacer"></div>
          <div className="collaborators">
            {collaborators > 0 && (
              <span className="pill pill--teal">
                {collaborators} collaborator{collaborators !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className="editor-content">
        <div className="editor-sidebar">
          <PromptBox
            docId={doc.id}
            onGenerate={handleGenerate}
            onError={handleGenerateError}
          />
        </div>

        <div className="editor-main">
          <div className="canvas-wrapper">
            <Canvas
              doc={doc}
              onDocChange={handleDocChange}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              zoom={zoom}
              pan={pan}
            />
          </div>
          
          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}
        </div>

        <div className="editor-sidebar">
          <Inspector
            selectedNodes={selectedNodes}
            docId={doc.id}
            onDocChange={handleDocChange}
          />
        </div>
      </div>
    </div>
  );
}
