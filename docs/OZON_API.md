# Ozon Seller API 接口文档

> 基于Ozon官方API文档整理，用于ERP系统底层开发
> 官方文档：https://docs.ozon.ru/api/seller/zh/

## 1. 认证配置

### 1.1 获取凭证
在Ozon卖家后台生成：
- **Client-Id**：客户端ID
- **Api-Key**：API密钥

### 1.2 请求头配置
```http
Client-Id: {你的ClientID}
Api-Key: {你的API密钥}
Content-Type: application/json
```

### 1.3 基础URL
```
https://api-seller.ozon.ru
```

---

## 2. 订单管理接口（核心）

### 2.1 获取订单列表
**接口**: `POST /v3/posting/fbs/list`

**用途**: 获取FBS订单列表，用于订单同步

**请求体**:
```json
{
  "dir": "ASC",
  "filter": {
    "since": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z",
    "status": "awaiting_packaging",
    "warehouse_id": []
  },
  "limit": 100,
  "offset": 0,
  "with": {
    "analytics_data": true,
    "barcodes": true,
    "financial_data": true,
    "translit": true
  }
}
```

**订单状态说明**:
| 状态 | 说明 |
|------|------|
| `awaiting_packaging` | 待打包（已付款） |
| `awaiting_deliver` | 待发货 |
| `delivering` | 运输中 |
| `delivered` | 已签收 |
| `cancelled` | 已取消 |

**响应字段**:
```json
{
  "result": {
    "postings": [
      {
        "posting_number": "订单号",
        "order_id": 订单ID,
        "order_number": "订单编号",
        "status": "订单状态",
        "in_process_at": "创建时间",
        "products": [
          {
            "product_id": 商品ID,
            "offer_id": "SKU编码",
            "name": "商品名称",
            "quantity": 数量,
            "price": "单价"
          }
        ],
        "customer": {
          "name": "买家姓名",
          "phone": "联系电话",
          "email": "邮箱",
          "address": {
            "city": "城市",
            "address_line": "详细地址"
          }
        },
        "financial_data": {
          "products": [
            {
              "product_id": 商品ID,
              "old_price": "原价",
              "price": "售价",
              "total_discount_value": "折扣",
              "payout": "结算金额",
              "commission_amount": "佣金"
            }
          ]
        }
      }
    ],
    "has_next": true,
    "count": 总数
  }
}
```

### 2.2 获取订单详情
**接口**: `POST /v3/posting/fbs/get`

**请求体**:
```json
{
  "posting_number": "订单号"
}
```

### 2.3 订单打包（标记待发货）
**接口**: `POST /v3/posting/fbs/ship`

**用途**: 打包完成，标记订单为待发货状态

**请求体**:
```json
{
  "posting_number": "订单号",
  "packages": [
    {
      "items": [
        {
          "product_id": 商品ID,
          "quantity": 数量
        }
      ]
    }
  ]
}
```

### 2.4 设置物流单号
**接口**: `POST /v2/fbs/posting/tracking-number/set`

**用途**: 回传物流单号至Ozon

**请求体**:
```json
{
  "posting_number": "订单号",
  "tracking_number": "物流单号"
}
```

### 2.5 标记发货
**接口**: `POST /v2/fbs/posting/delivering`

**用途**: 标记订单为运输中

**请求体**:
```json
{
  "posting_number": "订单号"
}
```

### 2.6 标记已签收
**接口**: `POST /v2/fbs/posting/delivered`

**请求体**:
```json
{
  "posting_number": "订单号"
}
```

### 2.7 获取未履约订单
**接口**: `POST /v3/posting/fbs/unfulfilled/list`

**用途**: 获取无法履约的订单（如缺货）

---

## 3. 商品管理接口

### 3.1 批量获取商品信息
**接口**: `POST /v3/product/info/list`

**用途**: 批量拉取商品主信息

**请求体**:
```json
{
  "product_id": [12345678, 87654321],
  "offer_id": ["SKU001", "SKU002"]
}
```

**响应字段**:
```json
{
  "result": {
    "items": [
      {
        "product_id": 商品ID,
        "offer_id": "SKU编码",
        "name": "商品名称",
        "price": "价格",
        "old_price": "原价",
        "stocks": {
          "coming": 在途库存,
          "present": 当前库存,
          "reserved": 预留库存
        },
        "category_id": 类目ID,
        "status": {
          "state": "状态",
          "state_name": "状态名称"
        },
        "images": ["图片URL"],
        "barcode": "条码"
      }
    ]
  }
}
```

### 3.2 获取商品完整属性
**接口**: `POST /v4/product/info/attributes`

**请求体**:
```json
{
  "product_id": [12345678],
  "language": "DEFAULT"
}
```

### 3.3 更新商品库存
**接口**: `POST /v2/products/stocks`

**请求体**:
```json
{
  "stocks": [
    {
      "product_id": 商品ID,
      "offer_id": "SKU编码",
      "stock": 库存数量
    }
  ]
}
```

### 3.4 更新商品价格
**接口**: `POST /v1/product/import/prices`

**请求体**:
```json
{
  "prices": [
    {
      "product_id": 商品ID,
      "offer_id": "SKU编码",
      "price": "价格",
      "old_price": "原价",
      "premium_price": "会员价"
    }
  ]
}
```

---

## 4. 面单打印接口

### 4.1 获取面单
**接口**: `POST /v1/posting/fbs/package-label/get`

**用途**: 获取订单面单PDF

**请求体**:
```json
{
  "posting_number": ["订单号1", "订单号2"]
}
```

**响应**: 返回PDF文件（base64编码）

---

## 5. 财务结算接口

### 5.1 获取财务报告
**接口**: `POST /v3/finance/cash-flow-statement/list`

**用途**: 获取资金流水，用于利润核算

### 5.2 获取结算金额
通过订单详情的 `financial_data` 字段获取：
- `payout`：实际结算金额
- `commission_amount`：平台佣金
- `total_discount_value`：折扣金额

---

## 6. 退货管理接口

### 6.1 获取退货列表
**接口**: `POST /v3/returns/company/list`

### 6.2 处理退货申请
**接口**: `POST /v2/returns/company/process`

---

## 7. 仓库管理接口

### 7.1 获取仓库列表
**接口**: `POST /v1/warehouse/list`

**响应**:
```json
{
  "result": [
    {
      "warehouse_id": 仓库ID,
      "name": "仓库名称",
      "is_fbo_fulfillment": true
    }
  ]
}
```

---

## 8. ERP系统集成方案

### 8.1 订单同步流程
```
1. 定时调用 POST /v3/posting/fbs/list
   - 筛选 status: "awaiting_packaging" (已付款待打包)
   - 同步订单数据到本地数据库
   
2. 解析订单商品信息
   - 获取 offer_id (SKU编码)
   - 查询SKU映射表匹配货源
   
3. 自动生成待采购任务
   - 记录Ozon订单号、SKU、数量
   - 关联货源链接（1688/拼多多）
```

### 8.2 发货流程
```
1. 打包完成后调用 POST /v3/posting/fbs/ship
   - 标记订单为待发货状态
   
2. 打印面单 POST /v1/posting/fbs/package-label/get

3. 设置物流单号 POST /v2/fbs/posting/tracking-number/set

4. 标记发货 POST /v2/fbs/posting/delivering
```

### 8.3 利润核算数据获取
```
通过 POST /v3/posting/fbs/get 获取：
- Ozon结算金额: financial_data.products[].payout
- 平台佣金: financial_data.products[].commission_amount
- 商品售价: financial_data.products[].price

利润计算：
真实净利润 = payout - 采购成本 - 国内运费 - 包材费 - 库存成本 - 售后损失
```

---

## 9. 错误处理

### 9.1 常见错误码
| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求体格式 |
| 401 | 认证失败 | 检查API Key和Client ID |
| 403 | 权限不足 | 检查API权限配置 |
| 404 | 资源不存在 | 检查订单号/商品ID |
| 429 | 请求过于频繁 | 降低请求频率 |
| 500 | 服务器错误 | 重试请求 |

### 9.2 请求频率限制
- 每秒最多20次请求
- 每分钟最多1000次请求
- 批量接口每次最多100条数据

---

## 10. 开发建议

### 10.1 数据同步策略
1. **订单同步**：每5分钟轮询 `awaiting_packaging` 状态订单
2. **库存同步**：库存变化时实时同步，或每小时批量同步
3. **价格同步**：价格变动时实时同步

### 10.2 数据存储建议
| 本地字段 | Ozon字段 | 说明 |
|----------|----------|------|
| ozon_order_id | posting_number | 订单号 |
| ozon_product_id | product_id | 商品ID |
| sku | offer_id | SKU编码 |
| payout_amount | financial_data.products[].payout | 结算金额 |

### 10.3 推送通知（Push Notifications）

Ozon支持推送通知功能，可以将订单状态变更、商品更新等信息实时推送到ERP系统。

**支持的通知类型**：
| 类型 | 说明 |
|------|------|
| `new_posting` | 创建新货件 |
| `posting_cancelled` | 发货取消 |
| `posting_status_changed` | 货件状态变更 |
| `posting_dates_changed` | 货件递送或发货日期更改 |
| `chat_new_message` | 新聊天消息 |
| `chat_closed` | 聊天关闭 |
| `product_changed` | 商品变更 |
| `product_stocks_changed` | 库存变更 |

**配置方法**：
1. 在Ozon卖家后台，转到"设置"→"集成"部分
2. 在"推送通知"选项卡上，启用推送通知
3. 输入Webhook URL：`https://你的域名/api/ozon/webhook`
4. 点击"检查"，Ozon会发送验证请求
5. 在"通知类型"下拉列表中选择所需的通知类型
6. 点击保存

**Webhook端点**：
- URL: `/api/ozon/webhook`
- 方法: POST (接收通知), GET (连接验证)
- 响应: `{ "success": true, "received": true }`

**通知数据示例**：
```json
{
  "event_type": "posting_status_changed",
  "posting_number": "0117427309-0243-1",
  "order_id": 37080103181,
  "old_status": "awaiting_packaging",
  "new_status": "awaiting_deliver",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 附录：接口分类速查表

### 订单相关
| 接口 | 用途 |
|------|------|
| POST /v3/posting/fbs/list | 获取订单列表 |
| POST /v3/posting/fbs/get | 获取订单详情 |
| POST /v3/posting/fbs/ship | 订单打包 |
| POST /v2/fbs/posting/tracking-number/set | 设置物流单号 |
| POST /v2/fbs/posting/delivering | 标记发货 |
| POST /v2/fbs/posting/delivered | 标记签收 |

### 商品相关
| 接口 | 用途 |
|------|------|
| POST /v3/product/info/list | 批量获取商品信息 |
| POST /v4/product/info/attributes | 获取商品属性 |
| POST /v2/products/stocks | 更新库存 |
| POST /v1/product/import/prices | 更新价格 |

### 面单相关
| 接口 | 用途 |
|------|------|
| POST /v1/posting/fbs/package-label/get | 获取面单PDF |

### 财务相关
| 接口 | 用途 |
|------|------|
| POST /v3/finance/cash-flow-statement/list | 获取资金流水 |

### 仓库相关
| 接口 | 用途 |
|------|------|
| POST /v1/warehouse/list | 获取仓库列表 |
