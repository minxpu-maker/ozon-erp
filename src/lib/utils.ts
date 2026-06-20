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
 * 格式化俄罗斯卢布金额
 */
export function formatRUB(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₽0.00';
  return `₽${num.toFixed(2)}`;
}

/**
 * 卢布转人民币估算（临时硬编码汇率，后续接入实时汇率）
 */
const RUB_TO_CNY_RATE = 0.07; // 1 RUB ≈ 0.07 CNY

export function formatCNYFromRUB(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '¥0.00';
  const cny = num * RUB_TO_CNY_RATE;
  return `¥${cny.toFixed(2)}`;
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

/**
 * Ozon订单状态 → 中文显示名
 */
export function getOrderStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    awaiting_packaging: '等待备货',
    awaiting_deliver: '待采购',
    delivering: '运输中',
    delivered: '已签收',
    cancelled: '已取消',
  };
  return statusMap[status] || '未知';
}

/**
 * Ozon订单状态 → 颜色配置
 */
export interface OrderStatusColor {
  bg: string;
  text: string;
  border: string;
}

export function getOrderStatusColor(status: string): OrderStatusColor {
  const colorMap: Record<string, OrderStatusColor> = {
    awaiting_packaging: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    awaiting_deliver: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    delivering: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    delivered: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
    cancelled: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
  };
  return colorMap[status] || { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
}
