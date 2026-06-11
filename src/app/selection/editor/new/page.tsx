'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

function NewProductCardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createDraft = async () => {
      setCreating(true);
      setError(null);
      
      try {
        // First, get real shop ID from database
        const shopsRes = await fetch('/api/shops');
        const shopsData = await shopsRes.json();
        
        let defaultShopId = null;
        if (shopsData.success && shopsData.data?.length > 0) {
          defaultShopId = shopsData.data[0].id;
        }
        
        if (!defaultShopId) {
          setError('请先创建店铺');
          return;
        }
        
        // Create a draft product card with default values
        const payload = {
          shopId: defaultShopId,
          categoryId: '100', // Default category: 服装配饰
          titleRu: '新商品卡',
          titleZh: '新商品卡',
          ...(opportunityId && { opportunityId }),
        };
        
        const res = await fetch('/api/selection/product-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        const data = await res.json();
        
        if (data.success && data.data?.id) {
          // Redirect to the editor with the new card ID
          router.replace(`/selection/editor/${data.data.id}`);
        } else {
          setError(data.error || '创建失败');
          // Fallback: redirect to editor with 'new' as id
          setTimeout(() => {
            router.replace('/selection/editor/new');
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to create product card:', err);
        setError('创建商品卡失败');
        // Fallback: redirect to editor with 'new' as id
        setTimeout(() => {
          router.replace('/selection/editor/new');
        }, 2000);
      } finally {
        setCreating(false);
      }
    };
    
    createDraft();
  }, [opportunityId, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {creating ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">正在创建草稿...</p>
          </>
        ) : error ? (
          <>
            <p className="text-red-500 mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">正在跳转到编辑器...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">正在初始化编辑器...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewProductCardPage() {
  return (
    <AppLayout title="新建商品卡" subtitle="正在初始化...">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">正在初始化编辑器...</p>
          </div>
        </div>
      }>
        <NewProductCardContent />
      </Suspense>
    </AppLayout>
  );
}