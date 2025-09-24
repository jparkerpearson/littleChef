// Prompt input component for LLM generation
import React, { useState } from 'react';
import { apiClient } from '../lib/api';

interface PromptBoxProps {
  docId: string;
  onGenerate: (ops: any[]) => void;
  onError: (error: string) => void;
}

export function PromptBox({ docId, onGenerate, onError }: PromptBoxProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  return (
    <div className="prompt-box">
      <h3>Little Chef</h3>
      <p>Describe what you want to create...</p>
      
      <div className="input-group">
        <textarea
          className="input"
          placeholder="e.g., Marketing hero with headline left, subhead, primary CTA, rounded image on the right; soft gray background"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={3}
          disabled={isGenerating}
        />
        <button
          className="btn btn--primary"
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? 'Little Chef is plating…' : 'Generate'}
        </button>
      </div>
      
      {isGenerating && (
        <div className="generating-indicator">
          <div className="spinner"></div>
          <span>Little Chef is plating…</span>
        </div>
      )}
    </div>
  );
}
