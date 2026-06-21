'use client';

import { useEffect, useState, useRef } from 'react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { formatCNYFromRUB } from '@/lib/utils';
import { Truck, RefreshCw, Search, ScanLine, CheckCircle, XCircle, Box, ShoppingCart, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function LogisticsPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [currentTask, setCurrentTask] = useState<any>(null);

  // 全屏扫码模式状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState<'pass' | 'fail' | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<any>(null);
  const [todayVerified, setTodayVerified] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanFeedback, setScanFeedback] = useState<'pass' | 'fail' | null>(null);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [exceptionType, setExceptionType] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');

  const EXCEPTION_TYPES = [
    { value: 'wrong_item', label: '商品不符' },
    { value: 'damaged', label: '商品破损' },
    { value: 'missing', label: '缺件/漏发' },
    { value: 'quality', label: '质量问题' },
    { value: 'other', label: '其他' },
  ];

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/logistics');
      const data = await res.json();
      if (data.success) {
        const taskList = Array.isArray(data.data) ? data.data : (data.data?.tasks || []);
        setTasks(taskList);
      }
    } catch (error) { console.error('获取任务失败:', error); }
    finally { setLoading(false); }
  };

  const handleScan = async () => {
    if (!trackingNumber) return;
    try {
      const res = await fetch(`/api/logistics?trackingNumber=${trackingNumber}`);
      const data = await res.json();
      if (data.success) setCurrentTask(data.data);
      else alert(data.error || '未找到对应订单');
    } catch (error) { console.error('扫描失败:', error); }
  };

  const handleInspection = async (result: 'pass' | 'fail') => {
    if (!currentTask?.task?.id) return;
    try {
      const res = await fetch('/api/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: currentTask.task.id, result }),
      });
      const data = await res.json();
      if (data.success) {
        alert(result === 'pass' ? '验货通过！订单已流转至打包发货' : '验货异常！已创建售后工单');
        setCurrentTask(null);
        setTrackingNumber('');
        fetchTasks();
      }
    } catch (error) { console.error('验货操作失败:', error); }
  };

  // 全屏扫码模式：扫码匹配
  const handleFullscreenScan = async () => {
    if (!scanCode.trim()) return;
    setScanFeedback(null);
    try {
      const res = await fetch(`/api/qc-records?express_no=${encodeURIComponent(scanCode.trim())}`);
      const data = await res.json();
      if (data.matched) {
        setScanResult('pass');
        setMatchedOrder(data.order);
        setScanFeedback('pass');
      } else {
        setScanResult('fail');
        setMatchedOrder(null);
        setScanFeedback('fail');
      }
    } catch {
      setScanResult('fail');
      setMatchedOrder(null);
      setScanFeedback('fail');
    }
    setScanCode('');
    setTimeout(() => setScanFeedback(null), 2000);
  };

  // 全屏快捷键处理
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsFullscreen(false); setScanCode(''); setScanResult(null); }
      if (e.key === ' ' && matchedOrder) {
        e.preventDefault();
        fetch('/api/qc-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: matchedOrder.id, qcResult: 'pass', expressNo: scanCode }),
        });
        setScanCode('');
        setScanResult(null);
        setMatchedOrder(null);
        setTodayVerified(c => c + 1);
        setPassCount(c => c + 1);
        setTimeout(() => scanInputRef.current?.focus(), 100);
      }
      if (e.key.toLowerCase() === 'e' && matchedOrder) {
        setShowExceptionDialog(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, matchedOrder, scanCode]);

  
return (
    <AppLayout title="入库验货" subtitle="扫描枪扫描快递单号 → 毫秒级响应 → 验货/异常处理">
              {/* 全屏扫码模式入口 */}
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => { setIsFullscreen(true); setTimeout(() => scanInputRef.current?.focus(), 200); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  <ScanLine className="w-4 h-4" />
                  全屏扫码
                </button>
              </div>

              {/* 扫描输入 */}
              {/* 扫描输入 */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
     <div className="flex items-center gap-4">
       <div className="flex items-center gap-2 flex-1">
         <ScanLine className="w-5 h-5 text-[#2F6BFF]" />
         <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && handleScan()}
           placeholder="扫描快递单号或手动输入..."
           className="flex-1 text-lg text-[#152033] placeholder:text-[#637089]/50 outline-none" autoFocus />
       </div>
       <button onClick={handleScan}
         className="px-6 py-3 bg-[#2F6BFF] text-white rounded-lg font-medium hover:bg-[#2F6BFF]/90">
         扫描查询
       </button>
     </div>
              </div>

              {/* 当前扫描结果 */}
              {currentTask && (
     <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-[#E6EAF2]">
       <h3 className="text-base font-semibold text-[#152033] mb-4">扫描结果 - 请核对商品信息</h3>

       {/* 快递信息 */}
       <div className="bg-[#F6F8FB] rounded-lg p-4 mb-4">
         <div className="grid grid-cols-4 gap-4">
           <div><span className="text-xs text-[#637089]">快递单号</span><div className="text-base font-medium text-[#2F6BFF]">{currentTask.task?.domestic_tracking_number}</div></div>
           <div><span className="text-xs text-[#637089]">SKU编码</span><div className="text-base font-medium text-[#152033]">{currentTask.task?.sku_code}</div></div>
           <div><span className="text-xs text-[#637089]">数量</span><div className="text-base font-medium text-[#152033]">{currentTask.task?.quantity}</div></div>
           <div><span className="text-xs text-[#637089]">采购状态</span><div className="text-base font-medium text-green-600">已采购</div></div>
         </div>
       </div>

       {/* 关联订单信息 */}
       <div className="border border-[#E6EAF2] rounded-lg p-4 mb-4">
         <h4 className="text-sm font-semibold text-[#152033] mb-3 flex items-center gap-2">
           <ShoppingCart className="w-4 h-4 text-[#2F6BFF]" />
           关联订单信息
         </h4>
         <div className="grid grid-cols-4 gap-4 mb-3">
           <div><span className="text-xs text-[#637089]">Ozon订单号</span><div className="text-sm font-medium text-[#2F6BFF]">{currentTask.order?.ozon_order_id}</div></div>
           <div><span className="text-xs text-[#637089]">发货单号</span><div className="text-sm font-medium text-[#152033]">{currentTask.order?.ozon_posting_number}</div></div>
           <div><span className="text-xs text-[#637089]">订单状态</span><div className="text-sm font-medium text-[#152033]">{currentTask.order?.status}</div></div>
           <div><span className="text-xs text-[#637089]">订单金额</span><div className="text-sm font-medium text-[#152033]">{formatCNYFromRUB(parseFloat(currentTask.order?.total_price || '0'))}</div></div>
         </div>
         <div className="grid grid-cols-3 gap-4">
           <div><span className="text-xs text-[#637089]">买家</span><div className="text-sm font-medium text-[#152033]">{currentTask.order?.buyer_name}</div></div>
           <div><span className="text-xs text-[#637089]">收货城市</span><div className="text-sm font-medium text-[#152033]">{currentTask.order?.recipient_city || '-'}</div></div>
           <div><span className="text-xs text-[#637089]">下单时间</span><div className="text-sm font-medium text-[#152033]">{currentTask.order?.ozon_created_at ? new Date(currentTask.order.ozon_created_at).toLocaleString('zh-CN') : '-'}</div></div>
         </div>
       </div>

       {/* 商品信息 */}
       {currentTask.product && (
         <div className="border border-[#E6EAF2] rounded-lg p-4 mb-4">
           <h4 className="text-sm font-semibold text-[#152033] mb-3 flex items-center gap-2">
             <Package className="w-4 h-4 text-[#2F6BFF]" />
             商品信息
           </h4>
           <div className="flex items-start gap-4">
             <div className="w-20 h-20 rounded-lg bg-[#F6F8FB] flex items-center justify-center overflow-hidden flex-shrink-0">
               {currentTask.product.image_url ? (
                 <img 
                   src={currentTask.product.image_url} 
                   alt={currentTask.product.name}
                   className="w-full h-full object-cover"
                 />
               ) : (
                 <Package className="w-8 h-8 text-[#637089]" />
               )}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-sm font-medium text-[#152033] mb-1" title={currentTask.product.name}>
                 {currentTask.product.name}
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div><span className="text-xs text-[#637089]">SKU</span><div className="text-sm text-[#152033]">{currentTask.product.offer_id}</div></div>
                 <div><span className="text-xs text-[#637089]">数量</span><div className="text-sm text-[#152033]">{currentTask.product.quantity}</div></div>
                 <div><span className="text-xs text-[#637089]">单价</span><div className="text-sm text-[#152033]">¥{currentTask.product.price}</div></div>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* 操作按钮 */}
       <div className="flex items-center gap-4 pt-2">
         <button onClick={() => handleInspection('pass')}
           className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
           <CheckCircle className="w-5 h-5" />验货通过
         </button>
         <button onClick={() => handleInspection('fail')}
           className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors">
           <XCircle className="w-5 h-5" />验货异常
         </button>
         <button onClick={() => { setCurrentTask(null); setTrackingNumber(''); }}
           className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-[#637089] rounded-lg font-medium hover:bg-gray-200 transition-colors">
           取消
         </button>
       </div>
     </div>
              )}

              {/* 待验货列表 */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-[#E6EAF2]">
     <h3 className="text-base font-semibold text-[#152033] mb-4">待验货列表</h3>
     {loading ? <div className="text-center py-8 text-[#637089]"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div> :
       tasks.length === 0 ? <div className="text-center py-8 text-[#637089]">暂无待验货任务</div> :
       <table className="w-full">
         <thead className="bg-[#F6F8FB]">
           <tr>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">商品信息</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">快递单号</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">SKU编码</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">关联订单</th>
             <th className="text-left text-xs font-medium text-[#637089] px-4 py-3">操作</th>
           </tr>
         </thead>
         <tbody>
           {tasks.map((item) => (
             <tr key={item.task?.id || item.id} className="border-t border-[#E6EAF2]">
               <td className="px-4 py-3">
                 <div className="flex items-center gap-2">
                   <div className="w-10 h-10 rounded bg-[#F6F8FB] flex items-center justify-center overflow-hidden flex-shrink-0">
                     {item.product?.image_url ? (
                       <img 
                         src={item.product.image_url} 
                         alt={item.product?.name}
                         className="w-full h-full object-cover"
                       />
                     ) : (
                       <Package className="w-5 h-5 text-[#637089]" />
                     )}
                   </div>
                   <div className="min-w-0">
                     <div className="text-sm text-[#152033] truncate max-w-[150px]" title={item.product?.name || '-'}>
                       {item.product?.name || '-'}
                     </div>
                     <div className="text-xs text-[#637089]">
                       {item.product?.price ? `¥${item.product.price}` : '-'}
                     </div>
                   </div>
                 </div>
               </td>
               <td className="px-4 py-3 text-sm font-medium text-[#2F6BFF]">{item.task?.domestic_tracking_number || '-'}</td>
               <td className="px-4 py-3 text-sm text-[#152033]">{item.task?.sku_code || '-'}</td>
               <td className="px-4 py-3">
                 <div className="text-sm text-[#2F6BFF] font-medium">{item.order?.ozon_order_id || '-'}</div>
                 <div className="text-xs text-[#637089]">{item.order?.ozon_posting_number || ''}</div>
               </td>
               <td className="px-4 py-3">
                 <button onClick={() => { 
                   setTrackingNumber(item.task?.domestic_tracking_number || ''); 
                   setTimeout(() => handleScan(), 100);
                 }}
                   className="px-3 py-1.5 text-xs bg-[#2F6BFF]/10 text-[#2F6BFF] rounded hover:bg-[#2F6BFF]/20 font-medium">验货</button>
               </td>
             </tr>
           ))}
         </tbody>
       </table>}
              </div>

              {/* ===== 全屏扫码模式 ===== */}
              {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">

                  {/* 顶部信息栏 */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gray-800 text-white">
                    <button
                      onClick={() => { setIsFullscreen(false); setScanCode(''); setScanResult(null); }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      ← 返回验货列表
                    </button>
                    <div className="text-sm text-gray-400">
                      按 Esc 退出全屏 | <kbd className="px-1 py-0.5 bg-gray-700 rounded">Space</kbd> 通过 | <kbd className="px-1 py-0.5 bg-gray-700 rounded">E</kbd> 异常
                    </div>
                  </div>

                  {/* 中央扫码输入区 */}
                  <div className="flex-1 flex flex-col items-center justify-center px-8">
                    <div className="w-full max-w-2xl">
                      <div className="text-center mb-8">
                        <ScanLine className={`w-20 h-20 mx-auto mb-4 transition-colors ${scanFeedback === 'pass' ? 'text-green-400' : scanFeedback === 'fail' ? 'text-red-400' : 'text-blue-400'}`} />
                        <h2 className="text-2xl font-bold text-white mb-2">扫描快递单号</h2>
                        <p className="text-gray-400 text-sm">对准扫描枪，按 Enter 确认</p>
                      </div>
                      <input
                        ref={scanInputRef}
                        type="text"
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFullscreenScan(); }}
                        placeholder="等待扫描..."
                        className={`w-full px-6 py-4 text-xl text-center font-mono border-2 rounded-xl focus:outline-none transition-colors ${
                          scanFeedback === 'pass' ? 'border-green-400 bg-green-400/10' :
                          scanFeedback === 'fail' ? 'border-red-400 bg-red-400/10' :
                          'border-gray-600 bg-gray-800 text-white'
                        }`}
                        autoFocus
                      />
                    </div>

                    {/* 扫码结果展示 */}
                    {scanResult && (
                      <div className={`mt-8 w-full max-w-2xl rounded-xl p-6 text-center transition-all ${
                        scanResult === 'pass' ? 'bg-green-500/20 border-2 border-green-500' : 'bg-red-500/20 border-2 border-red-500'
                      }`}>
                        {scanResult === 'pass' ? (
                          <>
                            <div className="text-6xl mb-4">✅</div>
                            <div className="text-2xl font-bold text-green-400 mb-2">匹配成功</div>
                            <div className="text-white font-medium">{matchedOrder?.products?.[0]?.name || '-'}</div>
                            <div className="text-gray-300 text-sm mt-1">{matchedOrder?.postingNumber || matchedOrder?.ozonPostingNumber || '-'}</div>
                            <div className="text-gray-400 text-xs mt-1">快递单号: {scanCode}</div>
                            <div className="mt-4 text-sm text-gray-400">按 <kbd className="px-1 py-0.5 bg-gray-700 rounded">Space</kbd> 验货通过 · <kbd className="px-1 py-0.5 bg-gray-700 rounded">E</kbd> 标记异常</div>
                          </>
                        ) : (
                          <>
                            <div className="text-6xl mb-4">❌</div>
                            <div className="text-2xl font-bold text-red-400 mb-2">未匹配到订单</div>
                            <div className="text-gray-300 text-sm">快递单号: <span className="font-mono">{scanCode}</span></div>
                            <div className="mt-4 text-sm text-gray-400">请检查快递单号或手动搜索</div>
                          </>
                        )}
                      </div>
                    )}

                    {/* 快捷键提示 */}
                    {!scanResult && (
                      <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
                        <span><kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300">Space</kbd> 验货通过</span>
                        <span><kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300">E</kbd> 标记异常</span>
                        <span><kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300">Esc</kbd> 退出</span>
                      </div>
                    )}
                  </div>

                  {/* 异常处理弹窗 */}
                  {showExceptionDialog && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900">标记异常</h3>
                          <p className="text-sm text-gray-500 mt-1">快递单号: <span className="font-mono">{scanCode}</span></p>
                        </div>
                        <div className="p-6 space-y-4">
                          {/* 异常类型选择 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">异常类型</label>
                            <div className="grid grid-cols-2 gap-2">
                              {EXCEPTION_TYPES.map(t => (
                                <button
                                  key={t.value}
                                  onClick={() => setExceptionType(t.value)}
                                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                                    exceptionType === t.value
                                      ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* 异常备注 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">备注（选填）</label>
                            <textarea
                              value={exceptionNote}
                              onChange={(e) => setExceptionNote(e.target.value)}
                              placeholder="补充异常说明..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 resize-none"
                              rows={3}
                            />
                          </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowExceptionDialog(false);
                              setExceptionType('');
                              setExceptionNote('');
                            }}
                          >
                            取消
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!exceptionType}
                            onClick={async () => {
                              await fetch('/api/qc-records', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  expressNo: scanCode,
                                  qcResult: 'fail',
                                  exceptionType,
                                  exceptionNote,
                                }),
                              });
                              setShowExceptionDialog(false);
                              setExceptionType('');
                              setExceptionNote('');
                              setScanCode('');
                              setScanResult(null);
                              setMatchedOrder(null);
                              setTodayVerified(c => c + 1);
                              setFailCount(c => c + 1);
                              setTimeout(() => scanInputRef.current?.focus(), 100);
                            }}
                          >
                            确认异常
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 底部进度条 */}
                  <div className="px-6 py-4 bg-gray-800 border-t border-gray-700">
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>今日已验 <span className="text-white font-bold">{todayVerified}</span> 件</span>
                      <div className="flex items-center gap-6">
                        <span>合格 <span className="text-green-400 font-bold">{passCount}</span></span>
                        <span>异常 <span className="text-red-400 font-bold">{failCount}</span></span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      {todayVerified > 0 && (
                        <div
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${(passCount / todayVerified) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>

                </div>
              )}

    </AppLayout>
  );
}