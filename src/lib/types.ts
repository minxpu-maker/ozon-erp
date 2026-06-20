export interface Product {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface OrderRecord {
  id: string;
  ozonOrderId: string;
  ozonPostingNumber: string;
  shopId: string;
  status: string;
  buyerName: string | null;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  orderAmount: number;
  warehouseId: string | null;
  warehouseName: string | null;
  products: Product[];
  erpStatus: string;
  createdAt: string;
  updatedAt: string;
  shipmentDeadline: string | null;
  isDeleted: boolean;
  purchaseStatus: string | null;
  purchasePrice: number | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  shopName?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrdersResponse {
  orders: OrderRecord[];
  pagination: Pagination;
}
