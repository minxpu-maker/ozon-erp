/**
 * 共享类型定义
 * 插件各模块（content script、background、popup）共用
 */

// ============================================================================
// 联合类型
// ============================================================================

/**
 * 数据来源平台
 * - wb: Wildberries
 * - ozon_market: Ozon 前台商品
 */
export type SourceType = 'wb' | 'ozon_market';

/**
 * 信号类型
 * - demand: 需求信号（WB热销商品，说明市场需求大）
 * - competition: 竞争信号（Ozon在售商品，说明竞争情况）
 */
export type SignalType = 'demand' | 'competition';

/**
 * 采集模式
 * - single: 一键采集（点一次采一条）
 * - continuous: 连续采集（每5秒自动采，翻页继续）
 */
export type CollectMode = 'single' | 'continuous';

/**
 * 推送状态
 * - pending: 待推送
 * - pushed: 已推送
 * - failed: 推送失败
 */
export type PushStatus = 'pending' | 'pushed' | 'failed';

/**
 * 处理状态
 * - created: 新建记录
 * - updated: 更新记录
 * - created_with_history: 新建并关联历史
 */
export type ProcessStatus = 'created' | 'updated' | 'created_with_history';

// ============================================================================
// 接口定义
// ============================================================================

/**
 * 卖家类型
 * - local: 本土卖家
 * - cross_border: 跨境卖家
 */
export type SellerType = 'local' | 'cross_border';

/**
 * 配送类型
 * - FBO: Ozon fulfillment
 * - FBS: 卖家自发货
 * - RFBS: RFBS
 * - FBP: FBP
 */
export type DeliveryType = 'FBO' | 'FBS' | 'RFBS' | 'FBP';

/**
 * 商品尺寸
 */
export interface ProductDimensions {
  /** 长度 mm */
  length: number;
  /** 宽度 mm */
  width: number;
  /** 高度 mm */
  height: number;
}

/**
 * 一条商品采集数据 (Schema V4)
 */
export interface MarketSignalPayload {
  // ========== 基础字段（已存在） ==========
  /** 来源平台 */
  sourceType: SourceType;
  /** 信号类型 */
  signalType: SignalType;
  /** 商品ID */
  productId: string;
  /** 商品标题（俄语原文） */
  productTitle: string;
  /** 商品详情页链接 */
  productUrl?: string;
  /** 类目路径，如"Женщинам / Верхняя одежда" */
  categoryPath?: string;
  /** 当前售价（卢布） */
  price?: number;
  /** 原价 */
  originalPrice?: number;
  /** 销量 */
  salesVolume?: number;
  /** 评分（1-5） */
  rating?: number;
  /** 评价数量 */
  reviewsCount?: number;
  /** 卖家数量（Ozon特有） */
  sellerCount?: number;
  /** 商品主图URL */
  imageUrl?: string;
  /** 图片URL数组 */
  images?: string[];
  /** 品牌名称 */
  brandName?: string;
  /** 原始页面数据（调试用） */
  rawData?: Record<string, unknown>;

  // ========== 商家与配送（6项） ==========
  /** 卖家名称 */
  sellerName?: string;
  /** 卖家类型：本土/跨境 */
  sellerType?: SellerType;
  /** 卖家粉丝/关注数量 */
  followerCount?: number;
  /** 商品变体数量 */
  variantCount?: number;
  /** 配送类型：FBO/FBS/RFBS/FBP */
  deliveryType?: DeliveryType;

  // ========== 商品规格（5项） ==========
  /** 商品重量 g */
  weight?: number;
  /** 商品尺寸 mm */
  dimensions?: ProductDimensions;
  /** 体积 L（自动计算：长×宽×高/1000000） */
  volume?: number;
  /** 上架日期 */
  listedDate?: string;
  /** 库存数量 */
  stock?: number;

  // ========== 计算/估算（3项） ==========
  /** 估算营收（price × salesVolume） */
  revenue?: number;
  /** 利润率（利润计算器算出） */
  profitRate?: number;
  /** 用户输入的采购成本 */
  purchaseCost?: number;

  // ========== API占位（5项，一期为空） ==========
  /** 退货率 */
  returnRate?: number;
  /** 展示次数 */
  impressions?: number;
  /** 商品卡片浏览量 */
  cardViews?: number;
  /** 加购率 */
  cartRate?: number;
  /** 广告占比 */
  adShare?: number;
}

/**
 * 批量推送请求
 */
export interface BatchPushRequest {
  /** 店铺ID（UUID格式） */
  shopId: string;
  /** 商品信号数组 */
  signals: MarketSignalPayload[];
}

/**
 * 单条推送结果
 */
export interface PushResult {
  /** 信号ID */
  signalId: number;
  /** 处理状态 */
  status: ProcessStatus;
  /** 是否触发跨平台匹配 */
  triggeredMatching: boolean;
}

/**
 * 批量推送响应
 */
export interface BatchPushResponse {
  /** 是否成功 */
  ok: boolean;
  /** 总数 */
  total?: number;
  /** 成功数 */
  success?: number;
  /** 跳过数 */
  skipped?: number;
  /** 各条记录的处理结果 */
  results: PushResult[];
  /** 错误信息（如果有） */
  error?: string;
  /** 重复警告 */
  duplicates?: Array<{ productId: string; reason: string }>;
}

/**
 * 插件配置
 */
export interface ExtensionConfig {
  /** ERP后端地址 */
  erpBaseUrl: string;
  /** 插件API Key（ozon_ext_开头） */
  apiKey: string;
  /** 绑定的店铺ID（UUID格式） */
  shopId: string;
  /** 店铺名称 */
  shopName: string;
}

/**
 * 采集历史记录
 */
export interface CollectionRecord {
  /** 记录ID */
  id: string;
  /** 采集平台 */
  platform: SourceType;
  /** 商品标题 */
  productTitle: string;
  /** 商品价格（可能无法解析） */
  price?: number;
  /** 商品主图 */
  imageUrl?: string;
  /** 采集时间（ISO时间字符串） */
  collectedAt: string;
  /** 推送状态 */
  pushStatus: PushStatus;
  /** 关联的信号ID（推送成功后） */
  signalId?: number;
  /** 错误信息（推送失败时） */
  error?: string;
}

// ============================================================================
// 消息类型定义（用于 content script 和 background 通信）
// ============================================================================

/**
 * 消息类型
 */
export type MessageType = 
  | 'COLLECT_SINGLE'      // 采集单条商品
  | 'COLLECT_START'       // 开始连续采集
  | 'COLLECT_STOP'        // 停止连续采集
  | 'PUSH_BATCH'          // 批量推送
  | 'PUSH_SIGNAL'         // 单条推送（来自content script）
  | 'PAGE_READY'          // 页面就绪通知
  | 'ONLINE'              // 网络恢复通知
  | 'FLUSH_OFFLINE'       // 刷新离线队列
  | 'GET_CONFIG'          // 获取配置
  | 'SET_CONFIG'          // 设置配置
  | 'GET_COLLECTIONS'     // 获取采集历史
  | 'CLEAR_COLLECTIONS'   // 清空采集历史
  | 'COLLECTION_COMPLETE' // 采集完成通知
  | 'PUSH_RESULT'         // 推送结果通知
  | 'VALIDATE_CONFIG';    // 验证配置

/**
 * 基础消息结构
 */
export interface BaseMessage<T extends MessageType = MessageType> {
  type: T;
  payload?: unknown;
}

/**
 * 采集单条商品消息
 */
export interface CollectSingleMessage extends BaseMessage<'COLLECT_SINGLE'> {
  payload: {
    sourceType: SourceType;
  };
}

/**
 * 开始连续采集消息
 */
export interface CollectStartMessage extends BaseMessage<'COLLECT_START'> {
  payload: {
    sourceType: SourceType;
    interval?: number; // 采集间隔（毫秒），默认5000
  };
}

/**
 * 批量推送消息
 */
export interface PushBatchMessage extends BaseMessage<'PUSH_BATCH'> {
  payload: BatchPushRequest;
}

/**
 * 设置配置消息
 */
export interface SetConfigMessage extends BaseMessage<'SET_CONFIG'> {
  payload: Partial<ExtensionConfig>;
}

/**
 * 消息响应基础结构
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 判断是否为有效的 SourceType
 */
export function isValidSourceType(value: string): value is SourceType {
  return value === 'wb' || value === 'ozon_market';
}

/**
 * 判断是否为有效的 SignalType
 */
export function isValidSignalType(value: string): value is SignalType {
  return value === 'demand' || value === 'competition';
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): ExtensionConfig {
  return {
    erpBaseUrl: '',
    apiKey: '',
    shopId: '',
    shopName: '',
  };
}

/**
 * 检查配置是否完整（所有必填字段都有值）
 */
export function isConfigComplete(config: ExtensionConfig): boolean {
  return Boolean(
    config.erpBaseUrl &&
    config.apiKey &&
    config.shopId &&
    config.shopName
  );
}

/**
 * 检查配置格式是否有效
 * - apiKey 必须以 ozon_ext_ 开头
 * - erpBaseUrl 必须是有效的 URL
 */
export function isConfigValid(config: ExtensionConfig): boolean {
  // 检查必填字段
  if (!isConfigComplete(config)) {
    return false;
  }
  
  // 检查 apiKey 格式
  if (!config.apiKey.startsWith('ozon_ext_')) {
    return false;
  }
  
  // 检查 erpBaseUrl 格式
  try {
    new URL(config.erpBaseUrl);
  } catch {
    return false;
  }
  
  return true;
}

// ============================================================================
// 插件面板类型（content script 使用）
// ============================================================================

/**
 * 插件运行配置（简化版，用于content script）
 */
export interface OzonExtConfig {
  /** 启用状态 */
  enabled: boolean;
  /** API地址 */
  apiUrl?: string;
  /** API Key */
  apiKey?: string;
  /** 店铺ID */
  shopId?: string;
  /** 语言设置 */
  language?: 'zh' | 'ru';
}

/**
 * 商品信息（content script 提取的数据）
 */
export interface ProductInfo {
  /** 平台 */
  platform: 'ozon' | 'wb';
  /** 商品ID */
  productId: string;
  /** 标题 */
  title?: string;
  /** 价格 */
  price?: number;
  /** 原价 */
  originalPrice?: number;
  /** 评分 */
  rating?: number;
  /** 评价数 */
  reviewsCount?: number;
  /** 销量 */
  salesVolume?: number;
  /** 销售额 */
  revenue?: number;
  /** 利润率 */
  profitRate?: number;
  /** 图片URL */
  imageUrl?: string;
  /** 图片URLs */
  images?: string[];
  /** 卖家名称 */
  sellerName?: string;
  /** 卖家类型 */
  sellerType?: SellerType;
  /** 粉丝数 */
  followerCount?: number;
  /** 变体数 */
  variantCount?: number;
  /** 配送类型 */
  deliveryType?: DeliveryType;
  /** 重量 */
  weight?: number;
  /** 尺寸 */
  dimensions?: ProductDimensions;
  /** 体积 */
  volume?: number;
  /** 上架日期 */
  listedDate?: string;
  /** 库存 */
  stock?: number;
  /** 类目 */
  category?: string;
  /** 品牌 */
  brand?: string;
  /** 销量排名 */
  salesRank?: number;
  /** 销量排名类目 */
  salesVolumeRank?: number;
}
