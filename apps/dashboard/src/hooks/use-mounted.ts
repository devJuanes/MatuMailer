'use client';

import { useEffect, useState } from 'react';

/** Evita mismatches de hidratación (p. ej. extensiones que mutan el DOM antes de React). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
