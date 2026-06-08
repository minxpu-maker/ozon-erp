/**
 * Ozon 类目相关 API 端点
 * 文档: https://docs.ozon.ru/api/seller/#tag/Description-category
 */

import { 
  Priority,
  CategoryTreeRequest,
  CategoryTreeResponse,
  CategoryAttributeRequest,
  CategoryAttributeResponse,
  CategoryAttributeValuesRequest,
  CategoryAttributeValuesResponse,
  SearchAttributeValuesRequest,
  CategoryTreeNode,
  CategoryAttribute,
  CategoryAttributeValue,
} from '../types';
import { ozonRequest } from '../client-new';

/**
 * 获取类目树
 * POST /v1/description-category/tree
 * 
 * @param shopId - 店铺ID
 * @param params - 请求参数
 * @returns 类目树
 */
export async function getCategoryTree(
  shopId: string,
  params: CategoryTreeRequest = {}
): Promise<CategoryTreeNode[]> {
  const response = await ozonRequest<CategoryTreeResponse>(
    shopId,
    '/v1/description-category/tree',
    {
      category_id: params.category_id,
      language: params.language || 'DEFAULT',
    },
    { priority: Priority.P2 } // 知识库同步优先级
  );
  
  return response.result || [];
}

/**
 * 获取类目属性定义
 * POST /v1/description-category/attribute
 * 
 * @param shopId - 店铺ID
 * @param categoryIds - 类目ID数组
 * @param language - 语言
 * @returns 类目属性列表
 */
export async function getCategoryAttributes(
  shopId: string,
  categoryIds: number[],
  language: 'DEFAULT' | 'RU' | 'EN' = 'DEFAULT'
): Promise<CategoryAttribute[]> {
  const response = await ozonRequest<CategoryAttributeResponse>(
    shopId,
    '/v1/description-category/attribute',
    {
      category_id: categoryIds,
      language,
    },
    { priority: Priority.P2 }
  );
  
  return response.result || [];
}

/**
 * 获取属性值字典
 * POST /v1/description-category/attribute/values
 * 
 * @param shopId - 店铺ID
 * @param params - 请求参数
 * @returns 属性值列表
 */
export async function getAttributeValues(
  shopId: string,
  params: CategoryAttributeValuesRequest
): Promise<{
  values: CategoryAttributeValue[];
  hasNext: boolean;
  lastValueId?: number;
}> {
  const response = await ozonRequest<CategoryAttributeValuesResponse>(
    shopId,
    '/v1/description-category/attribute/values',
    {
      attribute_id: params.attribute_id,
      category_id: params.category_id,
      last_value_id: params.last_value_id,
      limit: params.limit || 100,
    },
    { priority: Priority.P2 }
  );
  
  return {
    values: response.result || [],
    hasNext: response.has_next || false,
    lastValueId: response.last_value_id,
  };
}

/**
 * 搜索属性值
 * POST /v1/description-category/attribute/values/search
 * 
 * @param shopId - 店铺ID
 * @param params - 请求参数
 * @returns 匹配的属性值列表
 */
export async function searchAttributeValues(
  shopId: string,
  params: SearchAttributeValuesRequest
): Promise<CategoryAttributeValue[]> {
  const response = await ozonRequest<CategoryAttributeValuesResponse>(
    shopId,
    '/v1/description-category/attribute/values/search',
    {
      category_id: params.category_id,
      attribute_id: params.attribute_id,
      search_string: params.search_string,
      limit: params.limit || 100,
    },
    { priority: Priority.P2 }
  );
  
  return response.result || [];
}

/**
 * 获取完整类目树（递归获取所有层级）
 * 
 * @param shopId - 店铺ID
 * @returns 扁平化的类目列表（包含层级信息）
 */
export async function getFullCategoryTree(
  shopId: string
): Promise<Array<CategoryTreeNode & { level: number; parent_id?: number }>> {
  const flatCategories: Array<CategoryTreeNode & { level: number; parent_id?: number }> = [];
  
  async function flattenTree(
    nodes: CategoryTreeNode[],
    level: number,
    parentId?: number
  ): Promise<void> {
    for (const node of nodes) {
      flatCategories.push({
        ...node,
        level,
        parent_id: parentId,
      });
      
      if (node.children && node.children.length > 0) {
        await flattenTree(node.children, level + 1, node.category_id);
      }
    }
  }
  
  const tree = await getCategoryTree(shopId);
  await flattenTree(tree, 0);
  
  return flatCategories;
}
