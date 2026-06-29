/**
 * 快递公司识别工具
 * 根据快递单号前缀识别快递公司
 */

/**
 * 快递公司映射表
 * 前缀 → 快递公司名称
 */
const CARRIER_PREFIX_MAP: Record<string, string> = {
  // 圆通
  'YT': '圆通',
  
  // 中通
  '78': '中通',
  '76': '中通',
  '75': '中通',
  
  // 韵达
  '13': '韵达',
  '19': '韵达',
  '46': '韵达',
  
  // 申通
  '77': '申通',
  
  // 顺丰
  'SF': '顺丰',
  
  // 极兔
  'JT': '极兔',
};

/**
 * 根据快递单号识别快递公司
 * 
 * @param trackingNo - 快递单号
 * @returns 快递公司名称，如果无法识别则返回 null
 */
export function detectCarrier(trackingNo: string): string | null {
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
 * 获取所有支持的快递公司列表
 * 
 * @returns 快递公司名称数组
 */
export function getSupportedCarriers(): string[] {
  return ['圆通', '中通', '韵达', '申通', '顺丰', '极兔'];
}

/**
 * 快递公司前缀列表（用于前端展示）
 */
export const CARRIER_PREFIXES = [
  { carrier: '圆通', prefixes: ['YT'], example: 'YT1234567890' },
  { carrier: '中通', prefixes: ['78', '76', '75'], example: '7812345678' },
  { carrier: '韵达', prefixes: ['13', '19', '46'], example: '1312345678' },
  { carrier: '申通', prefixes: ['77'], example: '7712345678' },
  { carrier: '顺丰', prefixes: ['SF'], example: 'SF1234567890' },
  { carrier: '极兔', prefixes: ['JT'], example: 'JT1234567890' },
];