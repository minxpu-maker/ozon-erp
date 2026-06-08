'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  RefreshCw,
  Send,
  FileText,
  Package,
  Truck,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListingTask {
  id: number;
  productCardId: number;
  productCardName: string;
  shopId: string;
  shopName: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';
  ozonTaskId: string | null;
  ozonProductId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  failureReason: string | null;
}

export default function ListingManagementPage() {
  const [tasks, setTasks] = useState<ListingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/image-listing/listings');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data
  const mockTasks: ListingTask[] = [
    { 
      id: 1, 
      productCardId: 1, 
      productCardName: '男士夏季短袖T恤', 
      shopId: '1', 
      shopName: 'TIANTAN',
      status: 'published', 
      ozonTaskId: 'task_123', 
      ozonProductId: 'product_456',
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
      reviewedAt: new Date(Date.now() - 43200000).toISOString(),
      failureReason: null
    },
    { 
      id: 2, 
      productCardId: 2, 
      productCardName: '女士休闲运动裤', 
      shopId: '1', 
      shopName: 'TIANTAN',
      status: 'approved', 
      ozonTaskId: 'task_124', 
      ozonProductId: null,
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      reviewedAt: null,
      failureReason: null
    },
    { 
      id: 3, 
      productCardId: 3, 
      productCardName: '儿童纯棉睡衣套装', 
      shopId: '1', 
      shopName: 'TIANTAN',
      status: 'submitted', 
      ozonTaskId: 'task_125', 
      ozonProductId: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      failureReason: null
    },
    { 
      id: 4, 
      productCardId: 4, 
      productCardName: '真皮商务公文包', 
      shopId: '1', 
      shopName: 'TIANTAN',
      status: 'rejected', 
      ozonTaskId: 'task_126', 
      ozonProductId: null,
      submittedAt: new Date(Date.now() - 7200000).toISOString(),
      reviewedAt: new Date(Date.now() - 3600000).toISOString(),
      failureReason: '图片不符合要求：背景必须是纯白色'
    },
    { 
      id: 5, 
      productCardId: 5, 
      productCardName: '智能蓝牙耳机', 
      shopId: '1', 
      shopName: 'TIANTAN',
      status: 'draft', 
      ozonTaskId: null, 
      ozonProductId: null,
      submittedAt: null,
      reviewedAt: null,
      failureReason: null
    },
  ];

  const displayTasks = tasks.length > 0 ? tasks : mockTasks;

  const filteredTasks = displayTasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    draft: { color: 'bg-gray-100 text-gray-700', label: '草稿', icon: FileText },
    submitted: { color: 'bg-blue-100 text-blue-700', label: '审核中', icon: Clock },
    approved: { color: 'bg-green-100 text-green-700', label: '审核通过', icon: CheckCircle },
    rejected: { color: 'bg-red-100 text-red-700', label: '审核拒绝', icon: XCircle },
    published: { color: 'bg-purple-100 text-purple-700', label: '已上架', icon: Package },
  };

  const handleSubmit = async (id: number) => {
    // TODO: Call submit API
    console.log('Submit task:', id);
  };

  const handleCheckStatus = async (id: number) => {
    // TODO: Call status check API
    console.log('Check status:', id);
  };

  const handleViewProduct = (ozonProductId: string) => {
    // Open Ozon product page
    window.open(`https://www.ozon.ru/product/${ozonProductId}`, '_blank');
  };

  // Stats
  const stats = {
    total: displayTasks.length,
    draft: displayTasks.filter(t => t.status === 'draft').length,
    submitted: displayTasks.filter(t => t.status === 'submitted').length,
    approved: displayTasks.filter(t => t.status === 'approved').length,
    rejected: displayTasks.filter(t => t.status === 'rejected').length,
    published: displayTasks.filter(t => t.status === 'published').length,
  };

  return (
    <AppLayout title="上架管理" subtitle="Ozon商品上架任务管理">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">全部任务</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('draft')}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">草稿</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('submitted')}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
            <div className="text-sm text-muted-foreground">审核中</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('rejected')}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-muted-foreground">已拒绝</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('published')}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.published}</div>
            <div className="text-sm text-muted-foreground">已上架</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="submitted">审核中</SelectItem>
              <SelectItem value="approved">审核通过</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="published">已上架</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTasks}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            新建上架任务
          </Button>
        </div>
      </div>

      {/* Task Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-3 text-left text-sm">商品卡</th>
                <th className="p-3 text-left text-sm">店铺</th>
                <th className="p-3 text-left text-sm">状态</th>
                <th className="p-3 text-left text-sm">Ozon任务ID</th>
                <th className="p-3 text-left text-sm">提交时间</th>
                <th className="p-3 text-left text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => {
                const status = statusConfig[task.status];
                const StatusIcon = status.icon;
                
                return (
                  <tr key={task.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{task.productCardName}</div>
                      <div className="text-sm text-muted-foreground">#{task.productCardId}</div>
                    </td>
                    <td className="p-3">{task.shopName}</td>
                    <td className="p-3">
                      <Badge className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {task.ozonTaskId ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {task.ozonTaskId}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {task.submittedAt ? (
                        <div className="text-sm">
                          {new Date(task.submittedAt).toLocaleString('zh-CN')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {/* View Details */}
                        <Button variant="ghost" size="sm" title="查看详情">
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Submit (for draft) */}
                        {task.status === 'draft' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="提交上架"
                            onClick={() => handleSubmit(task.id)}
                          >
                            <Send className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}

                        {/* Check Status (for submitted) */}
                        {task.status === 'submitted' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="查询状态"
                            onClick={() => handleCheckStatus(task.id)}
                          >
                            <RefreshCw className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}

                        {/* View on Ozon (for published) */}
                        {task.status === 'published' && task.ozonProductId && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="在Ozon查看"
                            onClick={() => handleViewProduct(task.ozonProductId!)}
                          >
                            <ExternalLink className="w-4 h-4 text-purple-500" />
                          </Button>
                        )}

                        {/* Retry (for rejected) */}
                        {task.status === 'rejected' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="重新提交"
                          >
                            <RefreshCw className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      {filteredTasks.some(t => t.status === 'rejected') && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              拒绝原因汇总
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredTasks
                .filter(t => t.status === 'rejected' && t.failureReason)
                .map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <div className="font-medium">{task.productCardName}</div>
                      <div className="text-sm text-red-600">{task.failureReason}</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Tips */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">上架流程说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-sm">创建草稿</span>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-sm">提交审核</span>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-sm">Ozon审核</span>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="text-sm">审核通过</span>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-sm">商品上架</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
