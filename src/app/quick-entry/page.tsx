'use client';

import { useEffect, useState } from 'react';

import { AppLayout } from '@/components/layout/AppLayout';import {
  ClipboardList, RefreshCw, Clock, Link2, ShoppingBag, AlertTriangle, ChevronRight, CheckCircle, XCircle, Box, Database,
} from 'lucide-react';

interface QuickEntryTask {
  id: string;
  skuCode: string;
  quantity: number;
  ozonOrderId: string | null;
  postingNumber: string | null;
  sourceType: string | null;
}

export default function QuickEntryPage() {
  const [tasks, setTasks] = useState<QuickEntryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<'paste' | 'ocr' | 'excel'>('paste');
  const [pasteData, setPasteData] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/quick-entry');
      const data = await res.json();
      if (data.success) setTasks(data.data || []);
    } catch (error) {
      console.error('获取任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteSubmit = async () => {
    // 解析粘贴的数据：快递单号,采购金额,运费
    const lines = pasteData.split('\n').filter(Boolean);
    const entries = lines.map((line) => {
      const [trackingNumber, amount, shipping] = line.split(',');
      return { domesticTrackingNumber: trackingNumber, purchaseAmount: amount, shippingFee: shipping };
    });

    // TODO: 匹配任务并绑定
    console.log('Entries:', entries);
  };

  
return (
    <AppLayout title="快捷录单" subtitle="扫描枪 / 手动输入 / 批量导入三种录入方式">
              <div className="mb-6">
     <h1 className="text-2xl font-bold text-[#152033]">快捷录单</h1>
     <p className="text-sm text-[#637089] mt-1">三种录入方式：单号粘贴 / 截图OCR / Excel批量导入</p>
              </div>

              {/* 录入方式选择 */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-[#E6EAF2]">
     <div className="flex items-center gap-4">
       {[
         { key: 'paste', label: '单号粘贴', icon: ClipboardList },
         { key: 'ocr', label: '截图OCR', icon: Link2 },
         { key: 'excel', label: 'Excel导入', icon: Database },
       ].map((item) => {
         const Icon = item.icon;
         return (
           <button key={item.key}
             onClick={() => setEntryType(item.key as typeof entryType)}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${entryType === item.key ? 'bg-[#2F6BFF] text-white' : 'bg-[#EEF1F6] text-[#637089] hover:bg-[#E6EAF2]'}`}>
             <Icon className="w-4 h-4" />{item.label}
           </button>
         );
       })}
     </div>
              </div>

              {/* 单号粘贴录入 */}
              {entryType === 'paste' && (
     <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
       <h3 className="text-base font-semibold text-[#152033] mb-4">粘贴采购信息</h3>
       <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 mb-4">
         <p className="text-sm text-[#637089]">格式：快递单号,采购金额,运费（每行一条）</p>
         <p className="text-xs text-[#637089]/70 mt-1">示例：SF1234567890,25.50,5.00</p>
       </div>
       <textarea value={pasteData} onChange={(e) => setPasteData(e.target.value)}
         placeholder="粘贴采购信息..."
         className="w-full h-40 p-4 border border-[#E6EAF2] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30" />
       <div className="flex justify-end mt-4">
         <button onClick={handlePasteSubmit}
           className="px-4 py-2 bg-[#2F6BFF] text-white rounded-lg text-sm font-medium hover:bg-[#2F6BFF]/90">
           批量绑定
         </button>
       </div>
     </div>
              )}

              {/* 待绑定任务列表 */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
     <h3 className="text-base font-semibold text-[#152033] mb-4">待绑定采购任务</h3>
     {loading ? (
       <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
     ) : tasks.length === 0 ? (
       <div className="text-center py-8 text-[#637089]">暂无待绑定任务</div>
     ) : (
       <table className="w-full">
         <thead className="bg-[#F6F8FB]">
           <tr>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">数量</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">关联订单</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">货源平台</th>
           </tr>
         </thead>
         <tbody>
           {tasks.map((task) => (
             <tr key={task.id} className="border-t border-[#E6EAF2]">
               <td className="px-4 py-3 text-sm font-medium text-[#152033]">{task.skuCode}</td>
               <td className="px-4 py-3 text-sm text-[#152033]">{task.quantity}</td>
               <td className="px-4 py-3 text-sm text-[#2F6BFF]">{task.ozonOrderId || '-'}</td>
               <td className="px-4 py-3 text-sm text-[#152033]">{task.sourceType || '-'}</td>
             </tr>
           ))}
         </tbody>
       </table>
     )}
              </div>

    </AppLayout>
  );
}