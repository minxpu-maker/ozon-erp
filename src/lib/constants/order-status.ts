/**
 * 订单状态配置
 * Ozon 订单状态定义和转换
 */

// 导入 OzonPostingStatus 枚举（作为值使用）
import { OzonPostingStatus } from '@/types/ozon';
export { OzonPostingStatus };

// 状态配置类型
interface StatusConfig {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  description: string;
  order: number;
}

// Ozon FBS 订单状态配置
export const ORDER_STATUS_CONFIG: Record<OzonPostingStatus, StatusConfig> = {
  [OzonPostingStatus.AWAITING_PACKAGING]: {
    label: '待打包',
    labelEn: 'Awaiting Packaging',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: '订单已付款，等待打包',
    order: 1,
  },
  [OzonPostingStatus.AWAITING_DELIVERY]: {
    label: '待发货',
    labelEn: 'Awaiting Delivery',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: '订单已打包，等待发货',
    order: 2,
  },
  [OzonPostingStatus.DELIVERING]: {
    label: '配送中',
    labelEn: 'Delivering',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: '订单已发货，配送中',
    order: 3,
  },
  [OzonPostingStatus.DELIVERED]: {
    label: '已送达',
    labelEn: 'Delivered',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: '订单已送达客户',
    order: 4,
  },
  [OzonPostingStatus.CANCELLED]: {
    label: '已取消',
    labelEn: 'Cancelled',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    description: '订单已取消',
    order: 5,
  },
  [OzonPostingStatus.NOT_DELIVERED]: {
    label: '未送达',
    labelEn: 'Not Delivered',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: '订单未送达',
    order: 6,
  },
};

// ERP 内部订单状态（扩展）
export const ERP_ORDER_STATUS = {
  // 来自Ozon的状态
  ...ORDER_STATUS_CONFIG,
  // ERP 扩展状态
  pending_payment: {
    label: '待付款',
    labelEn: 'Pending Payment',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    description: '等待买家付款',
    order: 0,
  },
  pending_purchase: {
    label: '待采购',
    labelEn: 'Pending Purchase',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: '已付款，等待采购',
    order: 1.5,
  },
  pending_verify: {
    label: '待验货',
    labelEn: 'Pending Verify',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    description: '已采购，等待入库验货',
    order: 1.6,
  },
  returned: {
    label: '已退货',
    labelEn: 'Returned',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: '订单已退货',
    order: 6,
  },
} as const;

// 状态选项列表（用于筛选下拉框）
export const STATUS_OPTIONS = Object.entries(ORDER_STATUS_CONFIG).map(
  ([value, config]) => ({
    value,
    label: config.label,
  })
);

// ERP 状态选项列表
export const ERP_STATUS_OPTIONS = Object.entries(ERP_ORDER_STATUS).map(
  ([value, config]) => ({
    value,
    label: config.label,
  })
);

// 获取状态配置
export function getStatusConfig(status: OzonPostingStatus): StatusConfig {
  return ORDER_STATUS_CONFIG[status] || {
    label: status,
    labelEn: status,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    description: '未知状态',
    order: 99,
  };
}

// 状态徽标组件属性
export interface StatusBadgeProps {
  status: OzonPostingStatus;
  size?: 'sm' | 'md' | 'lg';
}
