'use client';

import { useEffect, useRef, useState } from 'react';
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
  bgLight: string;     // 浅色背景
  textColor: string;   // 文字色
  borderColor: string; // 边框色
  disabled?: boolean;
  disabledReason?: string;
}

export const PIPELINE_TABS: TabConfig[] = [
  { key: 'awaiting_packaging', label: '等待备货', color: 'amber', bgLight: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-400' },
  { key: 'awaiting_deliver', label: '待采购', color: 'blue', bgLight: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-400' },
  { key: 'delivering', label: '运输中', color: 'purple', bgLight: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-400' },
  { key: 'disputed', label: '具争议', color: 'red', bgLight: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-400', disabled: true, disabledReason: '功能开发中' },
  { key: 'delivered', label: '已签收', color: 'teal', bgLight: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-400' },
  { key: 'cancelled', label: '已取消', color: 'gray', bgLight: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-400' },
  { key: 'all', label: '全部', color: 'slate', bgLight: 'bg-slate-50', textColor: 'text-slate-700', borderColor: 'border-slate-400' },
];

// 数字动画 Hook
function useCountUp(target: number, duration: number = 300) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    
    if (diff === 0) return;
    
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out 缓动
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * easeOut);
      
      setDisplay(current);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = target;
      }
    };
    
    frameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, duration]);

  return display;
}

interface TabCardProps {
  tab: TabConfig;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function TabCard({ tab, count, isActive, onClick }: TabCardProps) {
  const animatedCount = useCountUp(count);
  const isDisabled = tab.disabled;

  return (
    <button
      onClick={() => !isDisabled && onClick()}
      disabled={isDisabled}
      title={isDisabled ? tab.disabledReason : undefined}
      className={cn(
        'min-w-[180px] flex-1 rounded-xl border-2 px-6 py-3 text-center transition-all duration-200 flex-shrink-0',
        'hover:-translate-y-0.5 hover:shadow-lg',
        // 默认态
        !isActive && !isDisabled && [
          'border-gray-200 bg-white text-gray-600',
        ],
        // 选中态
        isActive && !isDisabled && [
          'shadow-lg -translate-y-px',
          tab.borderColor,
          tab.bgLight,
        ],
        // 禁用态
        isDisabled && 'opacity-30 cursor-not-allowed border-gray-200',
        // 数字为0
        count === 0 && !isActive && 'opacity-40',
      )}
    >
      <div className={cn(
        'text-sm font-medium',
        isActive ? tab.textColor : 'text-gray-600',
        isDisabled && 'text-gray-400',
      )}>
        {tab.label}
      </div>
      <div className={cn(
        'text-2xl font-bold mt-1 transition-colors duration-150',
        isActive ? tab.textColor : 'text-gray-900',
        isDisabled && 'text-gray-400',
      )}>
        {animatedCount}
      </div>
    </button>
  );
}

// 箭头颜色映射
const arrowColors: Record<string, { active: string; inactive: string }> = {
  amber: { active: 'text-amber-400', inactive: 'text-gray-300' },
  blue: { active: 'text-blue-400', inactive: 'text-gray-300' },
  purple: { active: 'text-purple-400', inactive: 'text-gray-300' },
  red: { active: 'text-red-400', inactive: 'text-gray-300' },
  teal: { active: 'text-teal-400', inactive: 'text-gray-300' },
  gray: { active: 'text-gray-400', inactive: 'text-gray-300' },
  slate: { active: 'text-slate-400', inactive: 'text-gray-300' },
};

// 箭头组件
function Arrow({ isHighlighted, color }: { isHighlighted: boolean; color?: string }) {
  const colorKey = color || 'gray';
  const colors = arrowColors[colorKey] || arrowColors.gray;
  
  return (
    <svg
      className={cn(
        'w-4 h-4 flex-shrink-0 transition-colors duration-150 mx-1',
        isHighlighted ? colors.active : colors.inactive
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

import { OrderRecord } from './OrderCard';

type PipelineTabsProps = {
  orders: OrderRecord[];
  activeTab: OrderStatus | 'all';
  onTabChange: (tab: OrderStatus | 'all') => void;
}

export default function PipelineTabs({ orders, activeTab, onTabChange }: PipelineTabsProps) {
  // 计算每个Tab的订单数
  const counts: Record<string, number> = {};
  PIPELINE_TABS.forEach(tab => {
    if (tab.key === 'all') {
      counts[tab.key] = orders.length;
    } else {
      counts[tab.key] = orders.filter(o => o.status === tab.key).length;
    }
  });

  const activeTabConfig = PIPELINE_TABS.find(t => t.key === activeTab);
  const activeIndex = PIPELINE_TABS.findIndex(t => t.key === activeTab);
  
  // 流水线Tab（不含"全部"）和"全部"Tab分开
  const pipelineTabs = PIPELINE_TABS.filter(t => t.key !== 'all');
  const allTab = PIPELINE_TABS.find(t => t.key === 'all');

  return (
    <div className="relative flex justify-center px-4">
      {/* 滚动容器 */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-1">
        <div className="flex items-center justify-center">
          {/* 流水线Tab（等待备货→待采购→运输中→具争议→已签收→已取消）+ 箭头 */}
          {pipelineTabs.map((tab, index) => {
            const isHighlighted = activeTab === tab.key || activeIndex === index + 1;
            const isPrevHighlighted = activeTab === tab.key;
            const isNextHighlighted = activeTab === pipelineTabs[index + 1]?.key || (activeIndex === index + 1 && index < pipelineTabs.length - 1);
            
            return (
              <div key={tab.key} className="flex items-center">
                <TabCard
                  tab={tab}
                  count={counts[tab.key] ?? 0}
                  isActive={activeTab === tab.key}
                  onClick={() => onTabChange(tab.key)}
                />
                {/* 箭头：流水线Tab之间显示箭头 */}
                {index < pipelineTabs.length - 1 && (
                  <Arrow
                    isHighlighted={isHighlighted}
                    color={activeTabConfig?.color}
                  />
                )}
              </div>
            );
          })}
          
          {/* 分隔线 */}
          <div className="h-8 w-px bg-gray-200 mx-2 flex-shrink-0" />
          
          {/* "全部"Tab（无箭头） */}
          {allTab && (
            <TabCard
              tab={allTab}
              count={counts[allTab.key] ?? 0}
              isActive={activeTab === allTab.key}
              onClick={() => onTabChange(allTab.key)}
            />
          )}
        </div>
      </div>
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
