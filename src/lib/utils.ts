import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化人民币金额
 */
export function formatCNY(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '¥0.00';
  return `¥${num.toFixed(2)}`;
}

/**
 * 发货倒计时计算
 */
export type CountdownLevel = 'overdue' | 'urgent' | 'warning' | 'normal';

export interface CountdownResult {
  text: string;
  level: CountdownLevel;
}

export function getCountdown(deadline: Date | string | null | undefined): CountdownResult {
  // 空值处理
  if (!deadline) {
    return { text: '—', level: 'normal' };
  }

  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  const diffMs = deadlineTime - now;

  // 已超时
  if (diffMs < 0) {
    return { text: '已超时', level: 'overdue' };
  }

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = Math.floor(diffHours % 24);

  // 小于12小时 - urgent
  if (diffHours < 12) {
    return { text: `${Math.floor(diffHours)}h`, level: 'urgent' };
  }

  // 12-48小时 - warning
  if (diffHours < 48) {
    return { text: `${Math.floor(diffHours)}h`, level: 'warning' };
  }

  // 大于48小时 - normal
  if (diffDays > 0) {
    return { text: `${diffDays}d ${remainingHours}h`, level: 'normal' };
  }

  return { text: `${Math.floor(diffHours)}h`, level: 'normal' };
}
