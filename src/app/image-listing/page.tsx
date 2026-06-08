'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Image,
  Upload,
  Wand2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Grid,
  List,
  Package,
  Settings,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  compliancePassed: number;
  complianceFailed: number;
}

export default function ImageListingPage() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    compliancePassed: 0,
    complianceFailed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/image-listing/images');
      const data = await res.json();
      if (data.success) {
        const images = data.data || [];
        setStats({
          total: images.length,
          pending: images.filter((i: any) => i.status === 'pending').length,
          processing: images.filter((i: any) => i.status === 'processing').length,
          completed: images.filter((i: any) => i.status === 'completed').length,
          failed: images.filter((i: any) => i.status === 'failed').length,
          compliancePassed: images.filter((i: any) => i.complianceStatus === 'passed').length,
          complianceFailed: images.filter((i: any) => i.complianceStatus === 'failed').length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // 使用模拟数据
      setStats({
        total: 156,
        pending: 23,
        processing: 5,
        completed: 120,
        failed: 8,
        compliancePassed: 98,
        complianceFailed: 22,
      });
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    {
      title: '修图工作台',
      description: 'AI智能修图、合规检查、批量处理',
      href: '/image-listing/workbench',
      icon: Wand2,
      color: 'bg-blue-500',
      stats: `${stats.pending} 待处理`,
    },
    {
      title: '修图模板',
      description: '白底图、场景图、尺寸适配等模板管理',
      href: '/image-listing/templates',
      icon: Settings,
      color: 'bg-purple-500',
      stats: '8 个模板',
    },
    {
      title: '上架管理',
      description: '商品上架任务、审核状态、提交记录',
      href: '/image-listing/listing',
      icon: Package,
      color: 'bg-green-500',
      stats: `${stats.total} 个任务`,
    },
    {
      title: '流程总览',
      description: '完整流程看板、进度跟踪、异常监控',
      href: '/image-listing/pipeline',
      icon: LayoutGrid,
      color: 'bg-orange-500',
      stats: '全流程',
    },
  ];

  const recentImages = [
    { id: 1, name: '商品图-1.jpg', status: 'completed', compliance: 'passed', template: '白底图' },
    { id: 2, name: '商品图-2.jpg', status: 'completed', compliance: 'passed', template: '场景图' },
    { id: 3, name: '商品图-3.jpg', status: 'processing', compliance: 'pending', template: '白底图' },
    { id: 4, name: '商品图-4.jpg', status: 'failed', compliance: 'failed', template: '去背景' },
  ];

  return (
    <AppLayout title="修图上架" subtitle="AI智能修图与商品上架一体化管理">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">总图片数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.compliancePassed}</div>
                <div className="text-sm text-muted-foreground">合规通过</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">待处理</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.complianceFailed}</div>
                <div className="text-sm text-muted-foreground">不合规</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能模块入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.href} href={module.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2 rounded-lg text-white', module.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="font-semibold mb-1">{module.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                  <Badge variant="secondary" className="text-xs">{module.stats}</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 两列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近处理的图片 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">最近处理的图片</CardTitle>
            <Link href="/image-listing/workbench">
              <Button variant="ghost" size="sm">
                查看全部 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentImages.map((img) => (
                <div key={img.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{img.name}</div>
                      <div className="text-xs text-muted-foreground">{img.template}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {img.status === 'completed' && (
                      <Badge variant="secondary" className="text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" /> 完成
                      </Badge>
                    )}
                    {img.status === 'processing' && (
                      <Badge variant="secondary" className="text-blue-600">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 处理中
                      </Badge>
                    )}
                    {img.status === 'failed' && (
                      <Badge variant="secondary" className="text-red-600">
                        <XCircle className="w-3 h-3 mr-1" /> 失败
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 快捷操作 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">快捷操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/image-listing/workbench">
                <Button className="w-full h-20 flex-col gap-1" variant="outline">
                  <Upload className="w-5 h-5" />
                  <span>上传图片</span>
                </Button>
              </Link>
              <Link href="/image-listing/workbench">
                <Button className="w-full h-20 flex-col gap-1" variant="outline">
                  <Wand2 className="w-5 h-5" />
                  <span>批量修图</span>
                </Button>
              </Link>
              <Link href="/image-listing/templates">
                <Button className="w-full h-20 flex-col gap-1" variant="outline">
                  <Settings className="w-5 h-5" />
                  <span>模板设置</span>
                </Button>
              </Link>
              <Link href="/image-listing/listing">
                <Button className="w-full h-20 flex-col gap-1" variant="outline">
                  <Package className="w-5 h-5" />
                  <span>上架商品</span>
                </Button>
              </Link>
            </div>

            {/* 合规检查进度 */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>合规检查进度</span>
                <span>{stats.compliancePassed}/{stats.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${stats.total > 0 ? (stats.compliancePassed / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
