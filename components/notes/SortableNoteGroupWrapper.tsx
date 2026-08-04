import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableNoteGroupWrapperProps {
  id: string; // The dnd-kit id (e.g., 'sidebar-123')
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: React.HTMLAttributes<any>;
    listeners: React.DOMAttributes<any>;
    style: React.CSSProperties;
    isDragging: boolean;
  }) => React.ReactNode;
}

export function SortableNoteGroupWrapper({ id, children }: SortableNoteGroupWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return <>{children({ setNodeRef, attributes, listeners, style, isDragging })}</>;
}
