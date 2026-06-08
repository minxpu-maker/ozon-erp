'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  MessageSquare,
  Send,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  Globe,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle as XCircleIcon,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Opportunity {
  id: number;
  shopId: string;
  source: string;
  selectionMode: string;
  targetType: string;
  targetCategoryId: number | null;
  targetProductId: number | null;
  targetName: string;
  marketAnalysis: any;
  profitEstimate: any;
  riskFlags: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Radar data for 5 dimensions
const getRadarData = (scores: any) => [
  { subject: '利润空间', value: scores?.profit || 60, fullMark: 100, details: { rank: 1250, total: 5000 } },
  { subject: '竞争强度', value: 100 - (scores?.competition || 40), fullMark: 100, details: { rank: 3200, total: 5000 } },
  { subject: '需求热度', value: scores?.demand || 75, fullMark: 100, details: { rank: 800, total: 5000 } },
  { subject: '差异化潜力', value: scores?.differentiation || 55, fullMark: 100, details: { rank: 2100, total: 5000 } },
  { subject: '供应链稳定性', value: scores?.supply || 70, fullMark: 100, details: { rank: 1500, total: 5000 } },
];

// Data source icons
const dataSourceIcons: Record<string, any> = {
  ozon: Database,
  aliexpress: Globe,
  '1688': ShoppingCart,
  customs: AlertTriangle,
};

export default function SelectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('该商品具有较好的利润空间和中等竞争强度，建议作为优先选品目标。类目需求热度呈上升趋势，近30天销量增长约15%。差异化潜力较高，可以通过定制包装或组合销售来提升竞争力。');
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/selection/opportunities/${id}`);
      const data = await res.json();
      if (data.success) {
        setOpportunity(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch detail:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data
  const mockOpp: Opportunity = {
    id: Number(id) || 1,
    shopId: '8275dd99-f8fe-4560-a63a-774d15a03bbf',
    source: 'ozon',
    selectionMode: 'copy',
    targetType: 'product',
    targetCategoryId: 100,
    targetProductId: 1000,
    targetName: '女士冬季保暖羽绒服 中长款 修身显瘦 白鹅绒填充',
    marketAnalysis: {
      priceRange: { min: 1500, max: 3500 },
      sellerCount: 45,
      reviewCount: 320,
      avgRating: 4.5,
    },
    profitEstimate: {
      profitMargin: 35,
      roi: 85,
    },
    riskFlags: {},
    status: 'discovered',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const opp = opportunity || mockOpp;
  const scores = {
    profit: 68,
    competition: 42,
    demand: 75,
    differentiation: 58,
    supply: 72,
  };

  const grade = (() => {
    const avg = (scores.profit + (100 - scores.competition) + scores.demand + scores.differentiation + scores.supply) / 5;
    if (avg >= 70) return 'A';
    if (avg >= 55) return 'B';
    if (avg >= 40) return 'C';
    return 'D';
  })();

  // Trend data for Prophet
  const trendData = Array.from({ length: 30 }, (_, i) => ({
    date: `${30 - i}天前`,
    price: 2500 + Math.sin(i * 0.3) * 500 + Math.random() * 200,
    sales: 10 + Math.cos(i * 0.2) * 5 + Math.random() * 3,
    predicted: i < 7 ? 2800 + Math.sin((i + 30) * 0.3) * 500 : null,
  })).reverse();

  // Data sources
  const dataSources = [
    { name: 'Ozon API', icon: 'ozon', updateTime: '2分钟前', status: 'healthy', metrics: '价格: ¥2,680 | 销量: 156' },
    { name: '速卖通', icon: 'aliexpress', updateTime: '15分钟前', status: 'healthy', metrics: '同款: 12个 | 均价: ¥1,890' },
    { name: '1688', icon: '1688', updateTime: '1小时前', status: 'warning', metrics: '供应商: 8家 | 起订量: 10' },
    { name: '海关数据', icon: 'customs', updateTime: '3小时前', status: 'healthy', metrics: '类目合规 | 无风险' },
  ];

  // Hard constraints
  const hardConstraints = [
    { name: 'EAC认证要求', passed: true, message: '类目无需EAC认证' },
    { name: '价格竞争力', passed: true, message: '采购价加成后仍低于市场均价15%' },
    { name: '库存供应', passed: true, message: '1688供应商库存充足' },
    { name: '物流时效', passed: false, message: '大件商品需确认物流成本' },
    { name: '类目限制', passed: true, message: '无平台禁售风险' },
  ];

  const handleConfirm = async () => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      router.push(`/selection/editor/new?opportunityId=${id}`);
    } catch (error) {
      console.error('Failed to confirm:', error);
    }
  };

  const handleAbandon = async () => {
    try {
      await fetch(`/api/selection/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'abandoned' }),
      });
      router.push('/selection');
    } catch (error) {
      console.error('Failed to abandon:', error);
    }
  };

  const handleAskAI = async () => {
    // TODO: Call AI API
    setAiResponse('正在分析中...');
    setTimeout(() => {
      setAiResponse(`关于"${aiQuestion}"的分析：\n\n根据当前数据，该商品在过去30天内表现稳定，日均销量约12件，客单价¥2,680。主要竞品集中在3-5家，价格区间¥2,200-¥3,500。建议定价策略采用渗透定价，初期定价¥2,480以快速获取市场份额。`);
      setAiQuestion('');
    }, 1500);
  };

  if (loading) {
    return (
      <AppLayout title="选品详情" subtitle="加载中...">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="选品详情" subtitle={opp.targetName}>
      <div className="flex gap-4 h-full">
        {/* Left Panel - 60% */}
        <div className="w-[60%] space-y-4 overflow-auto">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => router.push('/selection')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回看板
          </Button>

          {/* Large Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>五维评分分析</span>
                <Badge className={cn(
                  'text-white',
                  grade === 'A' && 'bg-green-500',
                  grade === 'B' && 'bg-blue-500',
                  grade === 'C' && 'bg-orange-500',
                  grade === 'D' && 'bg-red-500'
                )}>
                  {grade}级评分
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart 
                    data={getRadarData(scores)}
                    onClick={(data) => {
                      if (data && data.activePayload) {
                        setExpandedDimension(
                          expandedDimension === data.activePayload[0].payload.subject 
                            ? null 
                            : data.activePayload[0].payload.subject
                        );
                      }
                    }}
                  >
                    <PolarGrid stroke="#E6EAF2" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} />
                    <Radar
                      name="评分"
                      dataKey="value"
                      stroke="#2F6BFF"
                      fill="#2F6BFF"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Dimension Details */}
              {expandedDimension && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">{expandedDimension} 明细</h4>
                  {(() => {
                    const dim = getRadarData(scores).find(d => d.subject === expandedDimension);
                    return (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">当前评分：</span>
                          <span className="font-medium">{dim?.value}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">排名：</span>
                          <span className="font-medium">{dim?.details?.rank} / {dim?.details?.total}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Four Data Sources */}
          <Card>
            <CardHeader>
              <CardTitle>四源数据面板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {dataSources.map(source => {
                  const Icon = dataSourceIcons[source.icon] || Database;
                  return (
                    <div 
                      key={source.name} 
                      className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">{source.name}</span>
                        <div className={cn(
                          'ml-auto w-2 h-2 rounded-full',
                          source.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                        )} />
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                        <Clock className="w-3 h-3" />
                        {source.updateTime}
                      </div>
                      <div className="text-sm">{source.metrics}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Prophet Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Prophet 趋势预测
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="price"
                      stroke="#2F6BFF"
                      fill="#2F6BFF"
                      fillOpacity={0.2}
                      name="价格"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="predicted"
                      stroke="#16A37B"
                      strokeDasharray="5 5"
                      dot={false}
                      name="预测价格"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Hard Constraints */}
          <Card>
            <CardHeader>
              <CardTitle>硬约束检查清单</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hardConstraints.map((constraint, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    {constraint.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{constraint.name}</div>
                      <div className="text-sm text-muted-foreground">{constraint.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - 40% */}
        <div className="w-[40%] space-y-4 overflow-auto">
          {/* Product Info */}
          <Card>
            <CardContent className="p-4">
              <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center">
                <span className="text-6xl">📦</span>
              </div>
              <h2 className="text-lg font-semibold mb-2">{opp.targetName}</h2>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>类目: {opp.targetCategoryId}</span>
                <span>来源: {opp.source}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-2xl font-bold">¥{opp.marketAnalysis?.priceRange?.min}</span>
                <span className="text-muted-foreground">- ¥{opp.marketAnalysis?.priceRange?.max}</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Interpretation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI 解读
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap mb-4">{aiResponse}</p>
              
              {/* Question Input */}
              <div className="flex gap-2">
                <Input 
                  placeholder="输入问题追问..." 
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                />
                <Button onClick={handleAskAI}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full bg-green-500 hover:bg-green-600" 
                size="lg"
                onClick={handleConfirm}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                确认选品
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full" 
                size="lg"
                onClick={handleAbandon}
              >
                <XCircle className="w-5 h-5 mr-2" />
                放弃
              </Button>

              {opp.selectionMode === 'copy' && (
                <Button variant="secondary" className="w-full" size="lg">
                  <RefreshCw className="w-5 h-5 mr-2" />
                  转精铺
                </Button>
              )}

              <Button variant="ghost" className="w-full" size="lg" asChild>
                <a href={`/selection/editor/new?opportunityId=${id}`}>
                  <ExternalLink className="w-5 h-5 mr-2" />
                  直接编辑商品卡
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Similar Products */}
          <Card>
            <CardHeader>
              <CardTitle>相似商品</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      📦
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium line-clamp-1">相似商品 {i}</div>
                      <div className="text-xs text-muted-foreground">¥{1500 + i * 500}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
