import React, { useEffect, useRef, useState } from 'react';

interface CanvasKeyboardProps {
  layout: string[][];
  onInput: (x: number, y: number, width: number, height: number, keyWidths: number[][], rowOffsets: number[]) => void;
  theme: 'light' | 'dark';
}

export const CanvasKeyboard: React.FC<CanvasKeyboardProps> = ({ layout, onInput, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [decoy, setDecoy] = useState<{ row: number; col: number } | null>(null);

  const colors = {
    light: {
      bg: '#f3f4f6',
      key: '#ffffff',
      keyShadow: '#d1d5db',
      text: '#111827',
      border: '#e5e7eb',
      highlight: '#7c3aed',
      decoy: '#ef4444'
    },
    dark: {
      bg: '#0f172a',
      key: '#1e293b',
      keyShadow: '#020617',
      text: '#e2e8f0',
      border: '#334155',
      highlight: '#a78bfa',
      decoy: '#f87171'
    }
  };

  const currentColors = colors[theme];

  // Standard PC Keyboard relative widths
  const KEY_WIDTHS = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], // Row 0: Esc (1), 1-0 (10), -= (2), Backspace (2) -> Actually let's make it 15 units total
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], // Row 1: Tab (1.5), Q-P (10), []\ (3) -> 15 units
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25], // Row 2: Caps (1.75), A-L (9), ;' (2), Enter (2.25) -> 15 units
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75], // Row 3: LShift (2.25), Z-M (7), ,./ (3), RShift (2.75) -> 15 units
    [1.5, 1.5, 6, 1.5, 1.5, 0.75, 0.75, 0.75, 0.75] // Row 4: Ctrl, Alt, Space, Alt, Ctrl, Arrows -> 15 units
  ];

  const getLayoutMetrics = (canvasWidth: number) => {
    const unit = canvasWidth / 15;
    const rowWidths = KEY_WIDTHS.map(row => row.map(w => w * unit));
    const rowOffsets = rowWidths.map(row => (canvasWidth - row.reduce((a, b) => a + b, 0)) / 2);
    return { rowWidths, rowOffsets, unit };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const { rowWidths, rowOffsets } = getLayoutMetrics(logicalWidth);
    const rowHeight = logicalHeight / KEY_WIDTHS.length;

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    
    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    bgGradient.addColorStop(0, currentColors.bg);
    bgGradient.addColorStop(1, theme === 'dark' ? '#020617' : '#e5e7eb');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    for (let r = 0; r < KEY_WIDTHS.length; r++) {
      let currentX = rowOffsets[r];
      const y = r * rowHeight;

      for (let c = 0; c < KEY_WIDTHS[r].length; c++) {
        const rw = rowWidths[r][c];
        const rh = rowHeight;
        
        const padding = logicalWidth < 640 ? 1 : 3;
        const rx = currentX + padding;
        const ry = y + padding;
        const kw = rw - padding * 2;
        const kh = rh - padding * 2;
        const radius = 6;

        if (layout[r] && layout[r][c] !== undefined) {
          // Shadow
          ctx.fillStyle = currentColors.keyShadow;
          ctx.beginPath();
          ctx.roundRect(rx, ry + 2, kw, kh, radius);
          ctx.fill();

          // Key Cap
          const isPressed = decoy && decoy.row === r && decoy.col === c;
          const keyGradient = ctx.createLinearGradient(rx, ry, rx, ry + kh);
          
          if (isPressed) {
            keyGradient.addColorStop(0, currentColors.highlight);
            keyGradient.addColorStop(1, theme === 'dark' ? '#4c1d95' : '#6d28d9');
          } else {
            keyGradient.addColorStop(0, currentColors.key);
            keyGradient.addColorStop(1, theme === 'dark' ? '#1e293b' : '#f9fafb');
          }

          ctx.fillStyle = keyGradient;
          ctx.strokeStyle = isPressed ? currentColors.highlight : currentColors.border;
          ctx.lineWidth = 1;
          
          ctx.beginPath();
          ctx.roundRect(rx, isPressed ? ry + 1 : ry, kw, kh, radius);
          ctx.fill();
          ctx.stroke();

          // Text
          if (layout[r][c]) {
            ctx.fillStyle = isPressed ? '#ffffff' : currentColors.text;
            const label = layout[r][c];
            let fontSize = Math.min(kw, kh) * 0.35;
            if (label.length > 1) fontSize *= 0.7;
            
            ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              label, 
              currentX + rw / 2, 
              (isPressed ? ry + 1 : ry) + kh / 2
            );
          }
        }
        currentX += rw;
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        
        // Adjust aspect ratio based on width for better mobile usability
        const aspectRatio = rect.width < 640 ? 0.55 : 0.38;
        const targetHeight = rect.width * aspectRatio;
        
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = targetHeight * dpr;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${targetHeight}px`;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        
        draw();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [layout, theme, decoy]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    const { rowWidths, rowOffsets } = getLayoutMetrics(logicalWidth);
    const rowHeight = logicalHeight / KEY_WIDTHS.length;
    const rowIdx = Math.floor(y / rowHeight);
    
    if (rowIdx >= 0 && rowIdx < KEY_WIDTHS.length) {
      let currentX = rowOffsets[rowIdx];
      let colIdx = -1;
      for (let i = 0; i < rowWidths[rowIdx].length; i++) {
        if (x >= currentX && x <= currentX + rowWidths[rowIdx][i]) {
          colIdx = i;
          break;
        }
        currentX += rowWidths[rowIdx][i];
      }

      if (colIdx !== -1) {
        setDecoy({ row: rowIdx, col: colIdx });
        setTimeout(() => setDecoy(null), 100);
      }
    }

    onInput(x, y, logicalWidth, logicalHeight, rowWidths, rowOffsets);
  };

  return (
    <div className={`w-full p-1 sm:p-2 rounded-2xl border shadow-2xl backdrop-blur-sm transition-colors ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleClick}
        onTouchStart={(e) => {
          e.preventDefault();
          handleClick(e);
        }}
        className="block cursor-pointer touch-none rounded-lg"
      />
    </div>
  );
};
