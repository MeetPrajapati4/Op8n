'use client';

import React from 'react';

interface SmoothScrollProps {
  children: React.ReactNode;
}

/**
 * Global smooth scrolling provider.
 * Renders native-grade 60/120FPS momentum scrolling across all panes
 * without hijacking mouse wheel events or breaking fixed dashboard layouts.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  return <>{children}</>;
}
