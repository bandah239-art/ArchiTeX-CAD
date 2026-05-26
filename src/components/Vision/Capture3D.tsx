import { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

export function Capture3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const simulateScan = () => {
    setIsScanning(true);
    // Simulate API delay
    setTimeout(() => {
      const mockPoints: Point[] = [];
      for (let i = 0; i < 1500; i++) {
        // Simple cylinder mock for rendering
        const theta = Math.random() * Math.PI * 2;
        const r = 1.0 + (Math.random() - 0.5) * 0.1;
        const h = Math.random() * 5.0;
        mockPoints.push({
          x: r * Math.cos(theta),
          y: h,
          z: r * Math.sin(theta),
          r: 100 + h * 20,
          g: 120 + h * 10,
          b: 140,
        });
      }
      setPoints(mockPoints);
      setIsScanning(false);
    }, 2000);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    let animationFrame: number;

    const render = () => {
      ctx.fillStyle = '#0f172a'; // infra-darker
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 100;
      const scale = 50;

      points.forEach((p) => {
        // Rotate around Y axis
        const rotX = p.x * Math.cos(angle) - p.z * Math.sin(angle);

        // Simple orthographic projection
        const screenX = centerX + rotX * scale;
        const screenY = centerY - p.y * scale;

        ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      angle += 0.02;
      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [points]);

  return (
    <div className="flex flex-col gap-4 p-4 border border-infra-accent/30 rounded bg-infra-darker">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-white uppercase">3D Reality Capture</h2>
          <p className="text-xs text-gray-400">Photogrammetry & Point Cloud Generation</p>
        </div>
        <button
          onClick={simulateScan}
          disabled={isScanning}
          className="px-4 py-2 bg-infra-highlight text-black text-xs font-bold rounded uppercase hover:bg-infra-accent disabled:opacity-50"
        >
          {isScanning ? 'Processing...' : 'Run 3D Scan'}
        </button>
      </div>

      <div className="relative w-full aspect-video bg-black rounded border border-infra-accent/20 overflow-hidden">
        {points.length === 0 && !isScanning && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            Point camera or upload video frames to generate 3D mesh
          </div>
        )}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center text-infra-highlight text-sm animate-pulse">
            Extracting features & matching points...
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className={`w-full h-full ${points.length > 0 ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000`}
        />
      </div>
    </div>
  );
}
