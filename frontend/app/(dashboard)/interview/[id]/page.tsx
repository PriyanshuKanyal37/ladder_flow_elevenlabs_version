'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyInterviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/interview');
  }, [router]);

  return null;
}

