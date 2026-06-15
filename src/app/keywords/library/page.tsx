'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Library, Plus, Trash2, Star, StarOff, Search, 
  Download, Eye, ArrowRight, FolderOpen, FolderPlus,
  MoreHorizontal, Edit, Check, X, TrendingUp, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface LibraryItem {
  id: number;
  keyword: string;
  platform: string;
  groupName: string | null;
  isFavorite: boolean;
  createdAt: string;
}

interface Group {
  name: string;
  count: number;
}

interface LibraryResponse {
  success: boolean;
  data: LibraryItem[];
  total: number;
}

export default function KeywordLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([
    { name: '全部', count: 0 },
    { name: '默认', count: 0 },
  ]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('全部');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [showFavorites, setShowFavorites] = useState(false);
  
  // 选中状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // 新建分组弹窗
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // 移动分组弹窗
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetGroup, setMoveTargetGroup] = useState('');
  
  // 重命名分组弹窗
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameOldName, setRenameOldName] = useState('');
  const [renameNewName, setRenameNewName] = useState('');

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroup && selectedGroup !== '全部') {
        params.set('group', selectedGroup);
      }
      if (showFavorites) params.set('favorite', 'true');
      if (selectedPlatform !== 'all') params.set('platform', selectedPlatform);
      
      const response = await fetch(`/api/keywords/library?${params}`);
      const data: LibraryResponse = await response.json();
      if (data.success) {
        setItems(data.data);
        setTotal(data.total);
        
        // 统计分组
        const groupMap = new Map<string, number>();
        groupMap.set('全部', data.total);
        
        data.data.forEach((item: LibraryItem) => {
          const g = item.groupName || '默认';
          groupMap.set(g, (groupMap.get(g) || 0) + 1);
        });
        
        const groupList: Group[] = [
          { name: '全部', count: data.total },
          { name: '默认', count: groupMap.get('默认') || 0 },
        ];
        groupMap.forEach((count, name) => {
          if (name !== '全部' && name !== '默认') {
            groupList.push({ name, count });
          }
        });
        setGroups(groupList);
      }
    } catch {
      alert('获取失败，请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, showFavorites, selectedPlatform]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // 添加关键词
  const handleAddKeyword = async (group?: string) => {
    if (!searchKeyword.trim()) return;
    
    try {
      const response = await fetch('/api/keywords/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: searchKeyword.trim(),
          group: group || selectedGroup
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        setSearchKeyword('');
        fetchLibrary();
      } else {
        alert(data.error || '添加失败，关键词可能已存在');
      }
    } catch {
      alert('网络错误');
    }
  };

  // 切换收藏
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

  // 删除单个
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除吗？')) return;
    
    try {
      const response = await fetch(`/api/keywords/library/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchLibrary();
      }
    } catch {
      alert('删除失败');
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 选择/取消单个
  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的关键词');
      return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个关键词吗？`)) return;
    
    try {
      let success = 0;
      for (const id of selectedIds) {
        const response = await fetch(`/api/keywords/library/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) success++;
      }
      setSelectedIds(new Set());
      fetchLibrary();
      alert(`成功删除 ${success} 个关键词`);
    } catch {
      alert('批量删除失败');
    }
  };

  // 移动到分组
  const handleMoveToGroup = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要移动的关键词');
      return;
    }
    
    try {
      let success = 0;
      for (const id of selectedIds) {
        const response = await fetch(`/api/keywords/library/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupName: moveTargetGroup }),
        });
        if (response.ok) success++;
      }
      setSelectedIds(new Set());
      setShowMoveDialog(false);
      fetchLibrary();
      alert(`成功移动 ${success} 个关键词到「${moveTargetGroup}」`);
    } catch {
      alert('移动失败');
    }
  };

  // 新建分组
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      alert('请输入分组名称');
      return;
    }
    
    // 创建分组只需要添加一个带该分组的关键词即可
    handleAddKeyword(newGroupName.trim());
    setNewGroupName('');
    setShowNewGroupDialog(false);
  };

  // 导出CSV
  const handleExportCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredItems.filter(item => selectedIds.has(item.id))
      : filteredItems;
    
    if (dataToExport.length === 0) {
      alert('没有可导出的数据');
      return;
    }
    
    const headers = ['关键词', '平台', '分组', '收藏', '添加时间'];
    const rows = dataToExport.map(item => [
      item.keyword,
      item.platform,
      item.groupName || '默认',
      item.isFavorite ? '是' : '否',
      new Date(item.createdAt).toLocaleDateString(),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `关键词库_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 筛选后的数据
  const filteredItems = items.filter(item => 
    item.keyword.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  return (
    <div className="flex gap-6 p-6 min-h-screen bg-background">
      {/* 左侧分组列表 */}
      <div className="w-56 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              分组管理
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {groups.map((group) => (
              <div
                key={group.name}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  selectedGroup === group.name 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedGroup(group.name)}
              >
                <span className="text-sm">{group.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedGroup === group.name 
                    ? 'bg-primary-foreground/20' 
                    : 'bg-muted'
                }`}>
                  {group.count}
                </span>
              </div>
            ))}
            
            <div className="pt-2 border-t mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-muted-foreground"
                onClick={() => setShowNewGroupDialog(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                新建分组
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 space-y-4">
        {/* 标题 */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">关键词库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理您收藏的关键词，支持分组和收藏标记
          </p>
        </div>

        {/* 工具栏 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              {/* 搜索框 */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入关键词添加..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  className="pl-10"
                />
              </div>
              
              {/* 平台筛选 */}
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="ozon">Ozon</SelectItem>
                  <SelectItem value="wb">Wildberries</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 收藏筛选 */}
              <Button
                variant={showFavorites ? 'default' : 'outline'}
                onClick={() => setShowFavorites(!showFavorites)}
              >
                <Star className="h-4 w-4 mr-1" />
                收藏
              </Button>
              
              {/* 统计 */}
              <div className="flex items-center px-3 text-sm text-muted-foreground">
                共 {total} 个关键词
                {selectedIds.size > 0 && `（已选 ${selectedIds.size} 个）`}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 批量操作 */}
        {selectedIds.size > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">已选择 {selectedIds.size} 个关键词：</span>
                <Button size="sm" variant="outline" onClick={() => setShowMoveDialog(true)}>
                  <ArrowRight className="h-4 w-4 mr-1" />
                  移动到分组
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  导出CSV
                </Button>
                <Button size="sm" variant="destructive" onClick={handleBatchDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  批量删除
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedIds(new Set())}
                >
                  取消选择
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 列表 */}
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>关键词</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>收藏</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className={selectedIds.has(item.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelectOne(item.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.keyword}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {item.platform === 'ozon' ? 'Ozon' : 'WB'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.groupName || '默认'}
                    </TableCell>
                    <TableCell>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="查看趋势"
                          onClick={() => window.open(`/keywords/trend?keyword=${encodeURIComponent(item.keyword)}`, '_blank')}
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="查看关联商品"
                          onClick={() => window.open(`/selection?keyword=${encodeURIComponent(item.keyword)}`, '_blank')}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="删除"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Library className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>暂无关键词</p>
                      <p className="text-sm mt-1">在输入框中输入关键词并按回车添加到词库</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 底部操作栏 */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? (
              <>已选择 {selectedIds.size} / {filteredItems.length} 个关键词</>
            ) : (
              <>显示 {filteredItems.length} 个关键词</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              导出全部
            </Button>
          </div>
        </div>
      </div>

      {/* 新建分组弹窗 */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
            <DialogDescription>创建一个新的关键词分组</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="输入分组名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateGroup}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动到分组弹窗 */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动到分组</DialogTitle>
            <DialogDescription>
              将选中的 {selectedIds.size} 个关键词移动到指定分组
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveTargetGroup} onValueChange={setMoveTargetGroup}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标分组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="默认">默认</SelectItem>
                {groups.filter(g => g.name !== '全部' && g.name !== '默认').map((g) => (
                  <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              取消
            </Button>
            <Button onClick={handleMoveToGroup} disabled={!moveTargetGroup}>
              确认移动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
