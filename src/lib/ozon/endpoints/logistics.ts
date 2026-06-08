/**
 * Ozon 物流相关 API 端点
 * 文档: https://docs.ozon.ru/api/seller/#tag/Logistics
 */

import {
  Priority,
  LogisticsTariffListRequest,
  LogisticsTariffListResponse,
  LogisticsTariff,
} from '../types';
import { ozonRequest } from '../client-new';

/**
 * 获取物流模板列表
 * POST /v1/logistics/tariff/list
 * 
 * 注意：此 API 可能需要特定权限或仅对某些店铺类型可用
 * 如果返回 404，可以尝试使用备选方案
 * 
 * @param shopId - 店铺ID
 * @param params - 请求参数（可选）
 * @returns 物流模板列表
 */
export async function getTariffList(
  shopId: string,
  params: LogisticsTariffListRequest = {}
): Promise<LogisticsTariff[]> {
  try {
    const response = await ozonRequest<LogisticsTariffListResponse>(
      shopId,
      '/v1/logistics/tariff/list',
      {
        filter: params.filter || {},
        limit: params.limit || 100,
        offset: params.offset || 0,
      },
      { priority: Priority.P2 } // 知识库同步优先级
    );
    
    return response.result || [];
  } catch (error) {
    // 如果是 404 错误，返回空数组而不是抛出错误
    if (error instanceof Error && error.message.includes('404')) {
      console.warn('[Ozon] Logistics tariff list API not available (404), returning empty array');
      return [];
    }
    throw error;
  }
}

/**
 * 获取默认物流模板
 * 
 * @param shopId - 店铺ID
 * @returns 默认物流模板（如果存在）
 */
export async function getDefaultTariff(
  shopId: string
): Promise<LogisticsTariff | null> {
  const tariffs = await getTariffList(shopId);
  
  // 优先返回经济型模板
  const economy = tariffs.find(t => t.is_economy);
  if (economy) return economy;
  
  // 否则返回第一个模板
  return tariffs[0] || null;
}

/**
 * 获取所有经济型物流模板
 * 
 * @param shopId - 店铺ID
 * @returns 经济型物流模板列表
 */
export async function getEconomyTariffs(
  shopId: string
): Promise<LogisticsTariff[]> {
  const tariffs = await getTariffList(shopId, {
    filter: { is_economy: true },
  });
  
  return tariffs;
}

/**
 * 获取所有快递物流模板
 * 
 * @param shopId - 店铺ID
 * @returns 快递物流模板列表
 */
export async function getExpressTariffs(
  shopId: string
): Promise<LogisticsTariff[]> {
  const tariffs = await getTariffList(shopId, {
    filter: { is_express: true },
  });
  
  return tariffs;
}

/**
 * 根据ID获取物流模板
 * 
 * @param shopId - 店铺ID
 * @param tariffId - 物流模板ID
 * @returns 物流模板（如果存在）
 */
export async function getTariffById(
  shopId: string,
  tariffId: number
): Promise<LogisticsTariff | null> {
  const tariffs = await getTariffList(shopId);
  return tariffs.find(t => t.id === tariffId) || null;
}
