'use client';

import { cn } from '@/lib/utils';

export type OrderStatus = 
  | 'awaiting_packaging'  // 等待备货
  | 'awaiting_deliver'    // 待采购
  | 'delivering'          // 运输中
  | 'disputed'            // 具争议(灰度预留)
  | 'delivered'           // 已签收
  | 'cancelled';          // 已取消

export interface TabConfig {
  key: OrderStatus | 'all';
  label: string;
  color: string;       // 主题色
  bgLight: string;    // 浅色背景
  textColor: string;  // 文字色
  disabled?: boolean;
  disabledReason?: string;
}

export const PIPELINE_TABS: TabConfig[] = [
  { key: 'awaiting_packaging', label: '等待备货', color: 'amber', bgLight: 'bg-amber-50', textColor: 'text-amber-700' },
  { key: 'awaiting_deliver', label: '待采购', color: 'blue', bgLight: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: 'delivering', label: '运输中', color: 'purple', bgLight: 'bg-purple-50', textColor: 'text-purple-700' },
  { key: 'disputed', label: '具争议', color: 'red', bgLight: 'bg-red-50', textColor: 'text-red-700', disabled: true, disabledReason: '功能开发中' },
  { key: 'delivered', label: '已签收', color: 'teal', bgLight: 'bg-teal-50', textColor: 'text-teal-700' },
  { key: 'cancelled', label: '已取消', color: 'gray', bgLight: 'bg-gray-50', textColor: 'text-gray-700' },
  { key: 'all', label: '全部', color: 'default', bgLight: 'bg-gray-50', textColor: 'text-gray-700' },
];

export function getTabColorClass(color: string, type: 'border' | 'bg' | 'text') {
  const colorMap: Record<string, Record<string, string>> = {
    amber: { border: 'border-amber-500', bg: 'bg-amber-500', text: 'text-amber-600' },
    blue: { border: 'border-blue-600', bg: 'bg-blue-600', text: 'text-blue-600' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-600' },
    red: { border: 'border-red-500', bg: 'bg-red-500', text: 'text-red-600' },
    teal: { border: 'border-teal-500', bg: 'bg-teal-500', text: 'text-teal-600' },
    gray: { border: 'border-gray-400', bg: 'bg-gray-500', text: 'text-gray-600' },
    default: { border: 'border-blue-600', bg: 'bg-blue-600', text: 'text-blue-600' },
  };
  return colorMap[color]?.[type] || colorMap.default[type];
}

interface PipelineTabsProps {
  activeTab: OrderStatus | 'all';
  onTabChange: (tab: OrderStatus | 'all') => void;
  counts: Record<OrderStatus | 'all', number>;
}

export default function PipelineTabs({ activeTab, onTabChange, counts }: PipelineTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      {PIPELINE_TABS.map(tab => {
        const isActive = activeTab === tab.key;
        const isDisabled = tab.disabled;
        const count = counts[tab.key] ?? 0;

        return (
          <button
            key={tab.key}
            onClick={() => !isDisabled && onTabChange(tab.key)}
            disabled={isDisabled}
            title={isDisabled ? tab.disabledReason : undefined}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-1.5 group',
              isDisabled && 'cursor-not-allowed opacity-50',
              !isDisabled && !isActive && 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              isActive && !isDisabled && cn(
                getTabColorClass(tab.color, 'text'),
                'font-semibold'
              )
            )}
          >
            {tab.label}
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full transition-colors',
              isActive
                ? cn(tab.bgLight, getTabColorClass(tab.color, 'text'))
                : 'bg-gray-100 text-gray-600'
            )}>
              {count}
            </span>
            
            {/* 底部高亮条 */}
            {isActive && !isDisabled && (
              <span className={cn(
                'absolute bottom-0 left-0 right-0 h-0.5',
                getTabColorClass(tab.color, 'bg')
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// 根据order的status判断属于哪个Tab
export function getOrderTabKey(status: string): OrderStatus | 'all' {
  const statusMap: Record<string, OrderStatus> = {
    'awaiting_packaging': 'awaiting_packaging',
    'awaiting_deliver': 'awaiting_deliver',
    'delivering': 'delivering',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
    // 兼容旧格式
    'awaiting-packaging': 'awaiting_packaging',
    'awaiting-deliver': 'awaiting_deliver',
  };
  return statusMap[status] || 'all';
}
