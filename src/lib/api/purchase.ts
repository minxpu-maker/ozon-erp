/**
 * 采购模块 API 调用层
 */

const API_BASE = "/api";

// 类型定义
export interface PurchaseStats {
  pendingPurchaseCount: number;
  orderedCount: number;
  orderedWithoutTrackingCount: number;
  inTransitCount: number;
  receivedCount: number;
  todayPurchasedCount: number;
  todayPurchasedAmount: number;
}

export interface PurchaseRecord {
  id: number;
  demandId: number;
  shopId: string;
  shopName?: string | null;
  supplierName: string | null;
  supplierSource: string | null;
  sourceUrl: string | null;
  purchasePrice: string | null;
  purchaseQty: number | null;
  totalPurchaseCost: string | null;
  shippingFee: string | null;
  domesticTrackingNo: string | null;
  domesticCarrier: string | null;
  domesticStatus: string | null;
  status: string;
  exceptionType: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  verifiedAt: string | null;
  purchaserId: string | null;
  boundBy: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  demandSku?: string | null;
  demandProductName?: string | null;
  demandQuantity?: number | null;
  demandProductImage?: string | null;  // 需求商品图
  ozonOrderIds?: number[];             // 关联的Ozon订单ID数组
  ozonPostingNumbers?: string[] | null; // Ozon订单号数组
}

export interface PurchaseDemand {
  id: number | null;
  orderId: string;
  sku: string | null;
  productName: string;
  productImage: string | null;
  quantity: number;
  priority: string | null;
  status: string | null;
  createdAt: string;
  order: {
    id: string;
    postingNumber: string | null;
    status: string;
    erpStatus: string | null;
    shipmentDeadline: string | null;
    shopId: string | null;
    shopName: string | null;
    totalPrice: string | null;
  } | null;
}

export interface CreatePurchaseRecordData {
  demandId: number;
  supplierSource: string;
  purchasePrice: number;
  domesticTrackingNo?: string;
  supplierName?: string;
  sourceUrl?: string;
  shippingFee?: number;
  purchaseQty?: number;
  purchaserId?: string;
  boundBy?: string;
  remark?: string;
}

export interface UpdatePurchaseRecordData {
  supplierName?: string;
  supplierSource?: string;
  sourceUrl?: string;
  purchasePrice?: number;
  purchaseQty?: number;
  shippingFee?: number;
  domesticTrackingNo?: string;
  domesticCarrier?: string;
  purchaserId?: string;
  boundBy?: string;
  remark?: string;
}

/**
 * 获取采购统计数据
 */
export async function fetchPurchaseStats(): Promise<PurchaseStats> {
  const response = await fetch(`${API_BASE}/purchase-records/stats`);
  if (!response.ok) {
    throw new Error("获取采购统计失败");
  }
  const json = await response.json();
  return json.data;
}

/**
 * 获取采购记录列表
 */
export async function fetchPurchaseRecords(
  params?: {
    status?: string;
    shopId?: string;
    domesticTrackingNo?: string;
    offset?: number;
    limit?: number;
  }
): Promise<PurchaseRecord[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.shopId) query.set("shopId", params.shopId);
  if (params?.domesticTrackingNo) query.set("domesticTrackingNo", params.domesticTrackingNo);
  if (params?.offset) query.set("offset", params.offset.toString());
  if (params?.limit) query.set("limit", params.limit.toString());

  const response = await fetch(`${API_BASE}/purchase-records?${query.toString()}`);
  if (!response.ok) {
    throw new Error("获取采购记录失败");
  }
  const json = await response.json();
  return json.data;
}

/**
 * 获取采购需求列表
 */
export async function fetchPurchaseDemands(
  params?: {
    status?: string;
    offset?: number;
    limit?: number;
  }
): Promise<PurchaseDemand[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.offset) query.set("offset", params.offset.toString());
  if (params?.limit) query.set("limit", params.limit.toString());

  const response = await fetch(`${API_BASE}/purchase-demands?${query.toString()}`);
  if (!response.ok) {
    throw new Error("获取采购需求失败");
  }
  const json = await response.json();
  return json.data || [];
}

/**
 * 创建采购记录
 */
export async function createPurchaseRecord(data: CreatePurchaseRecordData): Promise<PurchaseRecord> {
  const response = await fetch(`${API_BASE}/purchase-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "创建采购记录失败");
  }
  const json = await response.json();
  return json.data;
}

/**
 * 更新采购记录
 */
export async function updatePurchaseRecord(id: number, data: UpdatePurchaseRecordData): Promise<void> {
  const response = await fetch(`${API_BASE}/purchase-records/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "更新采购记录失败");
  }
}

/**
 * 更新采购记录状态
 */
export async function patchPurchaseRecordStatus(
  id: number,
  data: { domesticStatus?: string; status?: string; exceptionType?: string }
): Promise<void> {
  const response = await fetch(`${API_BASE}/purchase-records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "更新采购状态失败");
  }
}

/**
 * 删除（撤销）采购记录
 */
export async function deletePurchaseRecord(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/purchase-records/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "撤销采购失败");
  }
}

/**
 * 获取上次采购价
 */
export async function fetchLastPrice(sku: string): Promise<{
  purchasePrice: number | null;
  orderedAt: string | null;
  supplierName: string | null;
} | null> {
  const response = await fetch(`${API_BASE}/purchase-records/last-price?sku=${encodeURIComponent(sku)}`);
  if (!response.ok) {
    throw new Error("获取上次采购价失败");
  }
  const json = await response.json();
  return json.data;
}

/**
 * 绑定快递单号（内联录入）
 */
export async function bindTrackingNumber(
  id: number,
  data: { domesticTrackingNo: string; domesticCarrier?: string }
): Promise<void> {
  const response = await fetch(`${API_BASE}/purchase-records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "绑定快递单号失败");
  }
}