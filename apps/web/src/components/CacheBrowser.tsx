// Cache browser component for loading saved LLM responses
import React, { useState, useEffect } from 'react';
import { CachedResponse } from '../lib/api';
import { apiClient } from '../lib/api';

interface CacheBrowserProps {
    docId: string;
    onLoadCache: (ops: any[]) => void;
    onClose: () => void;
}

export default function CacheBrowser({ docId, onLoadCache, onClose }: CacheBrowserProps) {
    const [cachedResponses, setCachedResponses] = useState<CachedResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCache, setLoadingCache] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadCachedResponses();
    }, []);

    const loadCachedResponses = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.listCachedResponses();
            setCachedResponses(response.responses);
        } catch (err) {
            setError('Failed to load cached responses');
            console.error('Failed to load cached responses:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadCachedResponse = async (cacheId: string) => {
        try {
            setLoadingCache(cacheId);
            setError(null);
            const response = await apiClient.loadCachedResponse(cacheId, docId);
            onLoadCache(response.ops);
            onClose();
        } catch (err) {
            setError('Failed to load cached response');
            console.error('Failed to load cached response:', err);
        } finally {
            setLoadingCache(null);
        }
    };

    const deleteCachedResponse = async (cacheId: string) => {
        try {
            await apiClient.deleteCachedResponse(cacheId);
            await loadCachedResponses(); // Reload the list
        } catch (err) {
            setError('Failed to delete cached response');
            console.error('Failed to delete cached response:', err);
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const formatCacheAge = (timestamp: number) => {
        const now = Date.now();
        const age = now - timestamp;
        const minutes = Math.floor(age / (1000 * 60));
        const hours = Math.floor(age / (1000 * 60 * 60));
        const days = Math.floor(age / (1000 * 60 * 60 * 24));

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    };

    if (loading) {
        return (
            <div className="cache-browser">
                <div className="cache-browser-header">
                    <h3>Load Cached Response</h3>
                    <button className="btn btn--secondary" onClick={onClose}>×</button>
                </div>
                <div className="cache-browser-content">
                    <p>Loading cached responses...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cache-browser">
            <div className="cache-browser-header">
                <h3>Load Cached Response</h3>
                <button className="btn btn--secondary" onClick={onClose}>×</button>
            </div>

            <div className="cache-browser-content">
                {error && (
                    <div className="alert alert--error">
                        {error}
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {cachedResponses.length === 0 ? (
                    <div className="card">
                        <p>No cached responses found. Generate some content first!</p>
                    </div>
                ) : (
                    <div className="cache-list">
                        {cachedResponses.map((response) => (
                            <div key={response.id} className="cache-item">
                                <div className="cache-item-header">
                                    <h4>{response.prompt}</h4>
                                    <div className="cache-item-actions">
                                        <button
                                            className="btn btn--primary btn--sm"
                                            onClick={() => loadCachedResponse(response.id)}
                                            disabled={loadingCache === response.id}
                                        >
                                            {loadingCache === response.id ? 'Loading...' : 'Load'}
                                        </button>
                                        <button
                                            className="btn btn--secondary btn--sm"
                                            onClick={() => deleteCachedResponse(response.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="cache-item-details">
                                    <div className="cache-item-meta">
                                        <span className="cache-meta-item">
                                            <strong>Document:</strong> {response.docId}
                                        </span>
                                        <span className="cache-meta-item">
                                            <strong>Operations:</strong> {response.ops.length}
                                        </span>
                                        <span className="cache-meta-item">
                                            <strong>Created:</strong> {formatCacheAge(response.timestamp)}
                                        </span>
                                        {response.palette && response.palette.length > 0 && (
                                            <span className="cache-meta-item">
                                                <strong>Palette:</strong> {response.palette.join(', ')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="cache-item-summary">
                                        <p><strong>Document Summary:</strong> {response.docSummary}</p>
                                    </div>

                                    <div className="cache-item-timestamp">
                                        <small>{formatTimestamp(response.timestamp)}</small>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
