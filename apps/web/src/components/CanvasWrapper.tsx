// Dynamic wrapper for Canvas component to avoid SSR issues
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('./Canvas').then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="canvas-loading">Loading canvas...</div>
});

export { Canvas };
