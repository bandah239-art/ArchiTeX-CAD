import { useState, useEffect, useRef } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useDrawStore } from '../../store/drawStore';

/**
 * Floating text input that appears over the canvas when the text annotation
 * tool is active. Click a position → input appears → type → Enter to place.
 */
export function CanvasTextInput() {
  const activeTool   = useViewerStore((s) => s.activeTool);
  const { addTextAnnotation } = useDrawStore();
  const [pos, setPos]         = useState<{ x: number; y: number } | null>(null);
  const [worldPos, setWorldPos] = useState<{ x: number; z: number; y: number } | null>(null);
  const [value, setValue]     = useState('');
  const inputRef              = useRef<HTMLInputElement>(null);
  const containerRef          = useRef<HTMLDivElement>(null);

  const isTextTool = activeTool === 'draw.text';

  useEffect(() => {
    if (!isTextTool) {
      setPos(null);
      setValue('');
      return;
    }

    const canvas = document.getElementById('bimCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Compute approximate world position from screen position
      // For plan view: use canvas center as origin, scale by viewer ortho
      setPos({ x: e.clientX, y: e.clientY });
      setWorldPos({ x: sx / rect.width * 100, z: sy / rect.height * 100, y: 0 });
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [isTextTool]);

  const place = () => {
    if (!value.trim() || !worldPos) { setPos(null); return; }
    addTextAnnotation({ label: value.trim(), worldX: worldPos.x, worldZ: worldPos.z, worldY: worldPos.y });
    setPos(null);
    setValue('');
  };

  if (!isTextTool || !pos) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[500] pointer-events-auto"
      style={{ left: pos.x + 8, top: pos.y - 20 }}
    >
      <div className="bg-[#0f172a] border border-infra-highlight/60 rounded-lg shadow-2xl overflow-hidden flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') place();
            if (e.key === 'Escape') { setPos(null); setValue(''); }
          }}
          placeholder="Type label text…"
          className="bg-transparent text-white text-sm px-3 py-2 outline-none placeholder-gray-500 w-48"
          autoFocus
        />
        <div className="flex border-l border-infra-highlight/30">
          <button type="button" onClick={place}
            className="px-2 py-2 text-infra-highlight hover:bg-infra-highlight/20 text-xs font-bold transition-colors">
            ✓
          </button>
          <button type="button" onClick={() => { setPos(null); setValue(''); }}
            className="px-2 py-2 text-gray-500 hover:text-red-400 text-xs transition-colors">
            ✕
          </button>
        </div>
      </div>
      <div className="text-[9px] text-gray-600 mt-0.5 px-1">Enter to place · Esc to cancel</div>
    </div>
  );
}
