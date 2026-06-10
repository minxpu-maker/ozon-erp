/**
 * 常量定义和平台识别
 */

import { SourceType, SignalType } from './types';

/**
 * 默认的 ERP 后端地址
 */
export const DEFAULT_ERP_URL = 'https://292b3syh46.coze.site';

/**
 * 平台规则定义
 */
export interface PlatformRule {
  /** URL匹配正则 */
  pattern: RegExp;
  /** 平台类型 */
  platform: SourceType;
  /** 信号类型 */
  signalType: SignalType;
  /** 平台名称（显示用） */
  name: string;
  /** 平台图标（可选） */
  icon?: string;
  /** 颜色主题（可选） */
  color?: string;
}

/**
 * 平台匹配规则数组
 * 
 * 规则说明：
 * - Wildberries: 只匹配商品详情页 (/catalog/数字/detail.aspx)
 *   - signalType = 'demand' (需求信号，热销=有需求)
 * - Ozon: 匹配商品详情页 (/product/...)
 *   - signalType = 'competition' (竞争信号，在售=有竞争)
 */
export const PLATFORM_RULES: PlatformRule[] = [
  {
    // Wildberries 商品详情页格式: /catalog/{数字}/detail.aspx
    // 例如: https://www.wildberries.ru/catalog/12345/detail.aspx
    // 匹配域名: wildberries.ru 或 www.wildberries.ru 或任意子域名
    pattern: /https?:\/\/(?:[\w-]+\.)?wildberries\.ru\/catalog\/\d+\/detail\.aspx/i,
    platform: 'wb',
    signalType: 'demand',
    name: 'Wildberries',
    icon: '🛒',
    color: '#D02B2E', // Wildberries 品牌红
  },
  {
    // Ozon 商品详情页格式: /product/{slug}
    // 例如: https://ozon.ru/product/pyjkhvki-123456/
    // 匹配域名: ozon.ru 或 www.ozon.ru 或任意子域名
    pattern: /https?:\/\/(?:[\w-]+\.)?ozon\.ru\/product\//i,
    platform: 'ozon_market',
    signalType: 'competition',
    name: 'Ozon',
    icon: '📦',
    color: '#005BFF', // Ozon 品牌蓝
  },
];

/**
 * 根据URL识别当前页面属于哪个平台
 * @param url 页面URL
 * @returns 匹配的平台规则，未匹配返回 undefined
 */
export function getMatchedPlatform(url: string): PlatformRule | undefined {
  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(url)) {
      return rule;
    }
  }
  return undefined;
}

/**
 * 检查URL是否是支持的平台页面
 * @param url 页面URL
 * @returns true 表示是支持的平台
 */
export function isSupportedPlatform(url: string): boolean {
  return getMatchedPlatform(url) !== undefined;
}

/**
 * 获取所有支持的平台名称列表
 * @returns 平台名称数组
 */
export function getSupportedPlatforms(): string[] {
  return PLATFORM_RULES.map(rule => rule.name);
}

/**
 * 根据平台类型获取规则
 * @param platform 平台类型
 * @returns 平台规则或 undefined
 */
export function getPlatformRule(platform: SourceType): PlatformRule | undefined {
  return PLATFORM_RULES.find(rule => rule.platform === platform);
}

/**
 * 采集间隔常量（毫秒）
 */
export const COLLECTION_INTERVALS = {
  /** 连续采集间隔：5秒 */
  CONTINUOUS: 5000,
  /** 默认采集间隔：5秒 */
  DEFAULT: 5000,
  /** 最小采集间隔：1秒 */
  MIN: 1000,
  /** 最大采集间隔：60秒 */
  MAX: 60000,
} as const;

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  /** 插件配置 */
  CONFIG: 'ozon_extension_config',
  /** 采集历史记录 */
  COLLECTIONS: 'ozon_extension_collections',
  /** 采集状态 */
  COLLECTION_STATE: 'ozon_extension_collection_state',
  /** 离线队列 */
  OFFLINE_QUEUE: 'ozon_extension_offline_queue',
} as const;

/**
 * 消息类型常量
 */
export const MESSAGE_TYPES = {
  /** 采集单个商品 */
  COLLECT_SINGLE: 'COLLECT_SINGLE',
  /** 开始连续采集 */
  COLLECT_START: 'COLLECT_START',
  /** 停止连续采集 */
  COLLECT_STOP: 'COLLECT_STOP',
  /** 批量推送 */
  PUSH_BATCH: 'PUSH_BATCH',
  /** 单条推送（来自content script） */
  PUSH_SIGNAL: 'PUSH_SIGNAL',
  /** 页面就绪通知 */
  PAGE_READY: 'PAGE_READY',
  /** 获取配置 */
  GET_CONFIG: 'GET_CONFIG',
  /** 设置配置 */
  SET_CONFIG: 'SET_CONFIG',
  /** 获取采集记录 */
  GET_COLLECTIONS: 'GET_COLLECTIONS',
  /** 清除采集记录 */
  CLEAR_COLLECTIONS: 'CLEAR_COLLECTIONS',
  /** 采集完成通知 */
  COLLECTION_COMPLETE: 'COLLECTION_COMPLETE',
  /** 推送结果通知 */
  PUSH_RESULT: 'PUSH_RESULT',
} as const;

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  erpBaseUrl: DEFAULT_ERP_URL,
  apiKey: '',
  shopId: '',
  shopName: '',
} as const;
