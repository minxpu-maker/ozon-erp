'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface SyncNotificationData {
  newOrders: number;
  statusUpdates: number;
  shopCount: number;
  syncTime: string;
}

interface GlobalSyncContextType {
  syncNotification: SyncNotificationData | null;
  setSyncNotification: (data: SyncNotificationData | null) => void;
  triggerBackgroundSync: () => void;
}

const GlobalSyncContext = createContext<GlobalSyncContextType>({
  syncNotification: null,
  setSyncNotification: () => {},
  triggerBackgroundSync: () => {},
});

export function useGlobalSync() {
  return useContext(GlobalSyncContext);
}

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const [syncNotification, setSyncNotification] = useState<SyncNotificationData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderCountRef = useRef<number>(0);

  // 触发后台同步
  const triggerBackgroundSync = useCallback(() => {
    // 这个函数可以被外部调用来触发一次同步检查
    // 实际同步逻辑在组件内部处理
  }, []);

  // 启动定时同步轮询
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // 获取当前订单数量
        const res = await fetch('/api/orders?pageSize=1');
        const data = await res.json();
        const totalCount = data.total || 0;
        
        // 如果订单数量变化，说明有同步发生
        if (lastOrderCountRef.current > 0 && totalCount !== lastOrderCountRef.current) {
          const diff = totalCount - lastOrderCountRef.current;
          const syncTime = new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          
          // 弹出通知
          setSyncNotification({
            newOrders: diff > 0 ? diff : 0,
            statusUpdates: diff < 0 ? Math.abs(diff) : 0,
            shopCount: 1,
            syncTime: syncTime,
          });
        }
        
        // 更新计数
        lastOrderCountRef.current = totalCount;
      } catch (error) {
        console.error('[GlobalSync] 检查更新失败:', error);
      }
    };

    // 每30秒检查一次
    intervalRef.current = setInterval(checkForUpdates, 30000);

    // 初始化获取当前订单数
    checkForUpdates();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <GlobalSyncContext.Provider value={{ syncNotification, setSyncNotification, triggerBackgroundSync }}>
      {children}
    </GlobalSyncContext.Provider>
  );
}
