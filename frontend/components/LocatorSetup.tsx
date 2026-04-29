'use client';

import { useEffect } from 'react';
import setupLocatorUI from '@locator/runtime';

export function LocatorSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setupLocatorUI();
    }
  }, []);

  return null;
}
