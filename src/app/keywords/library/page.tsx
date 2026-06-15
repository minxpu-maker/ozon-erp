'use client';

import { useState, useEffect, useCallback } from 'react';
import { Library, Plus, Trash2, Star, StarOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface LibraryItem {
  id: number;
  keyword: string;
  platform: string;
  groupName: string | null;
  isFavorite: boolean;
  createdAt: string;
}

interface LibraryResponse {
  success: boolean;
  data: LibraryItem[];
  total: number;
}

export default function KeywordLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [filter, setFilter] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showFavorites) params.set('favorite', 'true');
      if (filter) params.set('group', filter);
      
      const response = await fetch(`/api/keywords/library?${params}`);
      const data: LibraryResponse = await response.json();
      if (data.success) {
        setItems(data.data);
        setTotal(data.total);
      }
    } catch {
      alert('获取失败，请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  }, [showFavorites, filter]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    
    try {
      const response = await fetch('/api/keywords/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`「${newKeyword}」已添加到词库`);
        setNewKeyword('');
        fetchLibrary();
      } else {
        alert(data.error || '添加失败，关键词可能已存在');
      }
    } catch {
      alert('网络错误');
    }
  };

  const handleToggleFavorite = async (id: number, currentFavorite: boolean) => {
    try {
      const response = await fetch(`/api/keywords/library/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentFavorite }),
      });
      const data = await response.json();
      
      if (data.success) {
        fetchLibrary();
      }
    } catch {
      alert('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除吗？')) return;
    
    try {
      const response = await fetch(`/api/keywords/library/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        alert('删除成功');
        fetchLibrary();
      }
    } catch {
      alert('删除失败');
    }
  };

  const filteredItems = items.filter(item => 
    item.keyword.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">关键词库</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理您收藏的关键词，支持分组和收藏标记
        </p>
      </div>

      {/* 添加关键词 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              placeholder="输入关键词"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            />
            <Button onClick={handleAddKeyword}>
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索关键词..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFavorites ? 'default' : 'outline'}
          onClick={() => setShowFavorites(!showFavorites)}
        >
          <Star className="h-4 w-4 mr-1" />
          仅显示收藏
        </Button>
      </div>

      {/* 统计 */}
      <div className="text-sm text-muted-foreground">
        共 {total} 个关键词
      </div>

      {/* 列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">关键词列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>关键词</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>分组</TableHead>
                <TableHead className="text-center">收藏</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.keyword}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.platform}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.groupName || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleFavorite(item.id, item.isFavorite)}
                    >
                      {item.isFavorite ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    暂无关键词
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
