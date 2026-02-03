import { useState, useRef, useEffect } from 'react';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BugReportDialog from './BugReportDialog';
import { useTester } from '@/contexts/TesterContext';

const STORAGE_KEY = 'bug-button-position';

export const FloatingBugButton = () => {
  const { isTester, isLoading } = useTester();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(pos);
        setHasMoved(true);
      } catch {
        // Invalid saved position, use default
      }
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (hasMoved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position, hasMoved]);

  // Only show for testers
  if (isLoading || !isTester) {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    // Only count as moved if dragged more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }
    
    // Calculate new position (we move left/up from default position)
    const newX = dragRef.current.initialX - deltaX;
    const newY = dragRef.current.initialY - deltaY;
    
    // Clamp to screen bounds
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 100;
    
    setPosition({
      x: Math.max(-maxX + 60, Math.min(0, newX)),
      y: Math.max(-maxY + 100, Math.min(0, newY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={buttonRef}
      className="fixed bottom-20 md:bottom-6 right-4 z-40 touch-none select-none" 
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      data-hide-from-screenshot
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <BugReportDialog
        trigger={
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-2 hover:border-destructive hover:bg-destructive/10 transition-all"
            title="Report a Bug (drag to move)"
          >
            <Bug className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
};

export default FloatingBugButton;
