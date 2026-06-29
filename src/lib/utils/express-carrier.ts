/**
 * 快递公司识别工具
 * 根据快递单号前缀识别快递公司
 */

/**
 * 快递公司映射表
 * 前缀 → 快递公司名称
 */
const CARRIER_PREFIX_MAP: Record<string, string> = {
  // 圆通速递
  'YT': '圆通速递',
  
  // 中通快递
  '78': '中通快递',
  '76': '中通快递',
  '75': '中通快递',
  
  // 韵达快递
  '13': '韵达快递',
  '19': '韵达快递',
  '46': '韵达快递',
  
  // 申通快递
  '77': '申通快递',
  
  // 顺丰速运
  'SF': '顺丰速运',
  
  // 极兔速递
  'JT': '极兔速递',
};

/**
 * 快递公司颜色映射表
 * 用于 UI 展示
 */
const CARRIER_COLOR_MAP: Record<string, string> = {
  '圆通速递': '#E53935', // 红色
  '中通快递': '#1565C0', // 蓝色
  '韵达快递': '#FF6F00', // 橙色
  '申通快递': '#43A047', // 绿色
  '顺丰速运': '#000000', // 黑色
  '极兔速递': '#FF1744', // 红粉色
};

/**
 * 根据快递单号识别快递公司
 * 
 * @param trackingNo - 快递单号
 * @returns 快递公司名称，如果无法识别则返回 null
 */
export function identifyCarrier(trackingNo: string): string | null {
  if (!trackingNo || trackingNo.trim() === '') {
    return null;
  }

  const trimmedNo = trackingNo.trim().toUpperCase();

  // 检查前缀匹配
  for (const [prefix, carrier] of Object.entries(CARRIER_PREFIX_MAP)) {
    if (trimmedNo.startsWith(prefix.toUpperCase())) {
      return carrier;
    }
  }

  // 无法识别
  return null;
}

/**
 * 获取快递公司的主题颜色
 * 
 * @param carrierName - 快递公司名称
 * @returns 颜色值（hex），如果未找到返回默认灰色
 */
export function getCarrierColor(carrierName: string): string {
  return CARRIER_COLOR_MAP[carrierName] || '#6B7280'; // 默认灰色
}

/**
 * 获取所有支持的快递公司列表
 * 
 * @returns 快递公司名称数组
 */
export function getSupportedCarriers(): string[] {
  return ['圆通速递', '中通快递', '韵达快递', '申通快递', '顺丰速运', '极兔速递'];
}

/**
 * 快递公司前缀列表（用于前端展示）
 */
export const CARRIER_PREFIXES = [
  { carrier: '圆通速递', prefixes: ['YT'], example: 'YT1234567890', color: '#E53935' },
  { carrier: '中通快递', prefixes: ['78', '76', '75'], example: '7812345678', color: '#1565C0' },
  { carrier: '韵达快递', prefixes: ['13', '19', '46'], example: '1312345678', color: '#FF6F00' },
  { carrier: '申通快递', prefixes: ['77'], example: '7712345678', color: '#43A047' },
  { carrier: '顺丰速运', prefixes: ['SF'], example: 'SF1234567890', color: '#000000' },
  { carrier: '极兔速递', prefixes: ['JT'], example: 'JT1234567890', color: '#FF1744' },
];