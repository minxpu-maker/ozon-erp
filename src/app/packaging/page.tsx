'use client';

import { useEffect, useState } from 'react';

import { AppLayout } from '@/components/layout/AppLayout';import { Package, RefreshCw, Scale, Printer, CheckCircle, FileText, AlertCircle, Box } from 'lucide-react';

export default function PackagingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeight, setCurrentWeight] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/packaging');
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch (error) { console.error('获取订单失败:', error); }
    finally { setLoading(false); }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  // 切换单个订单选择
  const toggleSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // 打印面单
  const handlePrintLabel = async (orderIds?: string[]) => {
    const targetOrders = orderIds 
      ? orders.filter(o => orderIds.includes(o.id))
      : orders.filter(o => selectedOrders.has(o.id));

    if (targetOrders.length === 0) {
      setPrintError('请先选择要打印的订单');
      return;
    }

    setPrinting(true);
    setPrintError(null);
    setPrintSuccess(false);

    try {
      // 获取第一个订单的店铺ID（假设所有订单来自同一店铺）
      const shopId = targetOrders[0].shop_id;
      const postingNumbers = targetOrders.map(o => o.ozon_posting_number);

      const res = await fetch('/api/packaging/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postingNumbers,
          shopId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '获取面单失败');
      }

      const { pdfBase64, fileUrl } = data.data;
      
      if (pdfBase64) {
        // 使用base64直接打印
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head><title>打印面单</title></head>
            <body style="margin:0;padding:0;">
              <embed width="100%" height="100%" 
                src="data:application/pdf;base64,${pdfBase64}" 
                type="application/pdf" 
                id="pdfEmbed">
            </body>
            </html>
          `);
          printWindow.document.close();
          // 延迟调用打印
          setTimeout(() => {
            printWindow.print();
          }, 500);
        }
      } else if (fileUrl) {
        // 降级：直接打开PDF URL
        window.open(fileUrl, '_blank');
      } else {
        throw new Error('未获取到面单');
      }

      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 3000);
    } catch (error: any) {
      console.error('打印面单失败:', error);
      setPrintError(error.message || '打印面单失败');
    } finally {
      setPrinting(false);
    }
  };

  // 单个订单打印
  const handleSinglePrint = (order: any) => {
    handlePrintLabel([order.id]);
  };

  
return (
    <AppLayout title="打包发货" subtitle="电子秤称重 → 打印Ozon面单 → 回传物流单号">
              <div className="mb-6">
     <h1 className="text-2xl font-bold text-[#152033]">打包发货</h1>
     <p className="text-sm text-[#637089] mt-1">电子秤称重 → 打印Ozon面单 → 回传物流单号</p>
              </div>

              {/* 称重面板 */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
     <div className="flex items-center gap-6">
       <div className="flex items-center gap-3">
         <Scale className="w-8 h-8 text-[#2F6BFF]" />
         <div>
           <div className="text-sm text-[#637089]">电子秤重量</div>
           <div className="text-3xl font-bold text-[#152033]">{currentWeight || '0.00'} <span className="text-lg font-normal">kg</span></div>
         </div>
       </div>
       <input type="text" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)}
         placeholder="手动输入重量..."
         className="px-4 py-3 border border-[#E6EAF2] rounded-lg text-lg w-48 focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30" />
     </div>
              </div>

              {/* 错误提示 */}
              {printError && (
     <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
       <AlertCircle className="w-5 h-5 text-red-500" />
       <span className="text-red-700">{printError}</span>
       <button onClick={() => setPrintError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
     </div>
              )}

              {/* 成功提示 */}
              {printSuccess && (
     <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
       <CheckCircle className="w-5 h-5 text-green-500" />
       <span className="text-green-700">面单已生成，正在打开打印窗口...</span>
     </div>
              )}

              {/* 待打包列表 */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
     <div className="flex items-center justify-between mb-4">
       <h3 className="text-base font-semibold text-[#152033]">待打包订单</h3>
       <div className="flex items-center gap-2">
         {selectedOrders.size > 0 && (
           <button 
             onClick={() => handlePrintLabel()}
             disabled={printing}
             className="flex items-center gap-1 px-3 py-1.5 bg-[#2F6BFF] text-white rounded text-xs hover:bg-[#2F6BFF]/90 disabled:opacity-50">
             <Printer className="w-3 h-3" />
             {printing ? '生成中...' : `批量打印面单 (${selectedOrders.size})`}
           </button>
         )}
       </div>
     </div>

     {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
       orders.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无待打包订单</div> :
       <table className="w-full">
         <thead className="bg-[#F6F8FB]">
           <tr>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3 w-10">
               <input 
                 type="checkbox" 
                 checked={selectedOrders.size === orders.length}
                 onChange={toggleSelectAll}
                 className="rounded border-[#E6EAF2]"
               />
             </th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">订单号</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">发货单号</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">店铺</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">买家</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">金额</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
           </tr>
         </thead>
         <tbody>
           {orders.map((item) => (
             <tr key={item.id} className="border-t border-[#E6EAF2] hover:bg-[#F6F8FB]">
               <td className="px-4 py-3">
                 <input 
                   type="checkbox" 
                   checked={selectedOrders.has(item.id)}
                   onChange={() => toggleSelect(item.id)}
                   className="rounded border-[#E6EAF2]"
                 />
               </td>
               <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{item.ozon_order_id}</td>
               <td className="px-4 py-3 text-sm text-[#152033]">{item.ozon_posting_number}</td>
               <td className="px-4 py-3"><span className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded text-xs">TIANTAN</span></td>
               <td className="px-4 py-3 text-sm text-[#152033]">{item.buyer_name}</td>
               <td className="px-4 py-3 text-sm text-[#152033]">¥{(parseFloat(item.total_price || 0) * 0.08).toFixed(2)}</td>
               <td className="px-4 py-3">
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => handleSinglePrint(item)}
                     disabled={printing}
                     className="flex items-center gap-1 px-3 py-1.5 bg-[#2F6BFF] text-white rounded text-xs hover:bg-[#2F6BFF]/90 disabled:opacity-50">
                     <Printer className="w-3 h-3" />打印
                   </button>
                   <button className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs hover:bg-green-600">
                     <CheckCircle className="w-3 h-3" />确认发货
                   </button>
                 </div>
               </td>
             </tr>
           ))}
         </tbody>
       </table>}
              </div>

    </AppLayout>
  );
}