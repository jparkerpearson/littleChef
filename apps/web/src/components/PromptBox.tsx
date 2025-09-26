// Prompt input component for LLM generation
import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import CacheBrowser from './CacheBrowser';

interface PromptBoxProps {
  docId: string;
  onGenerate: (ops: any[]) => void;
  onError: (error: string) => void;
}

export function PromptBox({ docId, onGenerate, onError }: PromptBoxProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCacheBrowser, setShowCacheBrowser] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await apiClient.generateOps(docId, prompt);
      onGenerate(response.ops);
      setPrompt(''); // Clear prompt after successful generation
    } catch (error) {
      console.error('Generation error:', error);
      onError('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleLoadCache = (ops: any[]) => {
    onGenerate(ops);
    setShowCacheBrowser(false);
  };

  return (
    <>
      <div className="prompt-box">
        <h3>Little Chef</h3>
        <p>Describe what you want to create...</p>

        <div className="prompt-input-section">
          <textarea
            className="prompt-textarea"
            placeholder="e.g., Marketing hero with headline left, subhead, primary CTA, rounded image on the right; soft gray background"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={4}
            disabled={isGenerating}
          />
          <div className="prompt-actions">
            <button
              className="btn btn--secondary"
              onClick={() => setShowCacheBrowser(true)}
              disabled={isGenerating}
            >
              Load Saved
            </button>
            <button
              className="btn btn--primary prompt-generate-btn"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? 'Little Chef is plating…' : 'Generate'}
            </button>
          </div>
        </div>

        {isGenerating && (
          <div className="generating-indicator">
            <div className="spinner"></div>
            <span>Little Chef is plating…</span>
          </div>
        )}
      </div>

      {showCacheBrowser && (
        <div className="modal-overlay" onClick={() => setShowCacheBrowser(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CacheBrowser
              docId={docId}
              onLoadCache={handleLoadCache}
              onClose={() => setShowCacheBrowser(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
