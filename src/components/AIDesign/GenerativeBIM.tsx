import { useState } from 'react';
import { BIMCanvas } from './BIMCanvas';
import { IconPlay } from '../VisionCapture/VisionIcons';

export function GenerativeBIM() {
  const [prompt, setPrompt] = useState('Generate a 3 story brick building 20x30m with windows and a pitched roof');
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/generate/bim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setModel(data);
        setStats(data.stats);
      } else {
        alert('Generation failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to Generative Engine.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-infra-dark text-infra-text p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white uppercase mb-2">Generative AI Structural Modeler</h2>
        <p className="text-xs text-gray-400 mb-4">
          Type a prompt describing the building grid, dimensions, and materials. The engine will procedurally generate a 3D structural frame.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-infra-highlight"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Generate a 2 story glass building 40x40m with a flat roof"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="px-4 py-2 bg-infra-highlight text-black font-medium rounded text-sm hover:bg-infra-highlight/90 flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : <><IconPlay className="w-4 h-4" /> Build</>}
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {!model && !isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-gray-700 rounded text-gray-500">
            Awaiting prompt to generate 3D mesh...
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center border border-infra-accent/30 rounded text-infra-highlight bg-infra-darker z-10">
            <span className="animate-pulse">Synthesizing parametric geometry...</span>
          </div>
        )}
        {model && (
          <BIMCanvas model={model} />
        )}
      </div>

      {stats && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400 bg-gray-900 p-2 rounded">
          <span><strong>Nodes:</strong> {stats.node_count}</span>
          <span><strong>Columns:</strong> {stats.column_count}</span>
          <span><strong>Beams:</strong> {stats.beam_count}</span>
          <span><strong>Slabs:</strong> {stats.slab_count}</span>
          {stats.wall_count > 0 && <span><strong>Walls:</strong> {stats.wall_count}</span>}
          {stats.window_count > 0 && <span><strong>Windows:</strong> {stats.window_count}</span>}
        </div>
      )}
    </div>
  );
}
