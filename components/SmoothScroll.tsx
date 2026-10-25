'use client';

import { ReactLenis } from 'lenis/react';
import React, { useEffect, useState } from 'react';

interface SmoothScrollProps {
  children: React.ReactNode;
}

/**
 * Global smooth scrolling provider powered by Lenis.
 * Provides inertia and physics-based buttery-smooth scrolling
 * across modern devices without breaking fixed studio layout.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ReactLenis
      root
      options={{
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
        infinite: false,
        autoRaf: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
