'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DeadlineRefreshOptions {
  deadline: string | Date | null;
  format: 'overdue' | 'today' | 'tomorrow' | 'later';
}

/**
 * 截止时间60秒静默刷新Hook
 * 每60秒更新DOM文本，不触发React重渲染
 */
export function useDeadlineRefresh(
  elementRef: React.RefObject<HTMLElement>,
  deadline: string | Date | null
) {
  const deadlineRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFormatRef = useRef<string>('');

  // 初始化deadline值
  useEffect(() => {
    if (deadline) {
      deadlineRef.current = typeof deadline === 'string' 
        ? new Date(deadline) 
        : deadline;
    } else {
      deadlineRef.current = null;
    }
  }, [deadline]);

  // 格式化截止时间文本
  const formatDeadline = useCallback((deadlineDate: Date): string => {
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    const hours = deadlineDate.getHours();
    const minutes = deadlineDate.getMinutes();
    const month = deadlineDate.getMonth() + 1;
    const day = deadlineDate.getDate();
    
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    if (diffMs <= 0) {
      // 已超时
      const overdueHours = Math.abs(diffHours);
      return `已超时${overdueHours}h`;
    } else if (diffHours <= 24 && deadlineDate.getDate() === now.getDate()) {
      // 今天
      return `今天 ${hoursStr}:${minutesStr}`;
    } else if (diffHours <= 48 && 
        deadlineDate.getDate() === new Date(now.getTime() + 24 * 60 * 60 * 1000).getDate()) {
      // 明天
      return `明天 ${hoursStr}:${minutesStr}`;
    } else {
      // 其他
      return `${monthStr}/${dayStr} ${hoursStr}:${minutesStr}`;
    }
  }, []);

  // 更新DOM文本
  const updateDom = useCallback(() => {
    if (!elementRef.current || !deadlineRef.current) return;
    
    const newFormat = formatDeadline(deadlineRef.current);
    
    // 只在格式变化时更新DOM，减少不必要的写入
    if (newFormat !== lastFormatRef.current) {
      elementRef.current.textContent = newFormat;
      lastFormatRef.current = newFormat;
    }
  }, [elementRef, formatDeadline]);

  // 启动定时刷新
  useEffect(() => {
    if (!deadlineRef.current) return;

    // 立即更新一次
    updateDom();

    // 页面可见性变化处理
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时暂停
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // 页面可见时恢复
        updateDom(); // 立即更新一次
        intervalRef.current = setInterval(updateDom, 60000);
      }
    };

    // 添加可见性监听
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 启动定时器（如果页面可见）
    if (!document.hidden) {
      intervalRef.current = setInterval(updateDom, 60000);
    }

    return () => {
      // 清理
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateDom]);

  return {
    deadlineRef,
    lastFormatRef,
  };
}