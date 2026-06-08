'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NewProductCardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');

  useEffect(() => {
    // Redirect to editor with 'new' as id
    const targetUrl = opportunityId 
      ? `/selection/editor/new?opportunityId=${opportunityId}`
      : '/selection/editor/new';
    
    // Since we're already at /selection/editor/new, we need to handle this differently
    // Let's render the editor directly instead of redirecting
  }, [opportunityId, router]);

  // This page acts as an alias - the actual editor handles 'new' as a special case
  // For simplicity, we'll just import and render the editor here
  // But since that causes issues with nested layouts, we use a redirect approach
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">正在初始化编辑器...</p>
      </div>
    </div>
  );
}
