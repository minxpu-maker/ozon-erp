'use client';

import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function KeywordReversePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">关键词反查</h1>
        <p className="text-sm text-muted-foreground mt-1">
          在商品详情页点击"关键词反查"，查看该商品的关联关键词
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">使用说明</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            1. 在Ozon/Wildberries商品详情页<br/>
            2. 点击导航栏"关键词" → "关键词反查"<br/>
            3. 系统将显示该商品的关联关键词列表
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
