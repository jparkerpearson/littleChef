// Home page - list documents and create new ones
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Doc } from '@little-chef/dsl';
import { apiClient } from '../lib/api';

export default function HomePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      const response = await apiClient.listDocs();
      setDocs(response.docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewDoc = async () => {
    if (creating) return;
    
    setCreating(true);
    try {
      const response = await apiClient.createDoc({
        width: 800,
        height: 600,
        title: 'Untitled Document'
      });
      
      // Redirect to editor
      window.location.href = `/d/${response.doc.id}`;
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="hero">
          <div className="hero-inner">
            <div>
              <h1 className="display">Little Chef</h1>
              <p className="lead">Loading your documents...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <nav className="navbar">
        <div className="nav-inner">
          <div className="brand">Little Chef</div>
          <div className="nav-spacer"></div>
          <button 
            className="nav-cta"
            onClick={createNewDoc}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'New Document'}
          </button>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-inner">
          <div>
            <h1 className="display">Little Chef</h1>
            <p className="lead">
              Create beautiful designs with the power of AI. 
              Describe what you want, and Little Chef will bring it to life.
            </p>
            <button 
              className="btn btn--primary"
              onClick={createNewDoc}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Start Cooking'}
            </button>
          </div>
          <div className="hero-card">
            <h3>How it works</h3>
            <div className="grid-3">
              <div className="tile tile--gold">
                <h4>1. Describe</h4>
                <p>Tell Little Chef what you want to create</p>
              </div>
              <div className="tile tile--teal">
                <h4>2. Generate</h4>
                <p>AI creates your design elements</p>
              </div>
              <div className="tile tile--orange">
                <h4>3. Edit</h4>
                <p>Fine-tune and customize your design</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Your Documents</h2>
        {docs.length === 0 ? (
          <div className="card">
            <p>No documents yet. Create your first document to get started!</p>
          </div>
        ) : (
          <div className="grid-3">
            {docs.map((doc) => (
              <Link key={doc.id} href={`/d/${doc.id}`}>
                <div className="card">
                  <h3>{doc.title || 'Untitled Document'}</h3>
                  <p>{doc.width} × {doc.height}px</p>
                  <p>{doc.nodes.length} elements</p>
                  <p className="text-sm text-gray-600">
                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
