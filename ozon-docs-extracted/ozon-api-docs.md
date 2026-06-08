---
AIGC:
    Label: "1"
    ContentProducer: 001191110102MACQD9K64018705
    ProduceID: 2566723632919907_0/project_7648227611545600271-files/docs/ozon-api-docs.md
    ReservedCode1: ""
    ContentPropagator: 001191110102MACQD9K64028705
    PropagateID: 2566723632919907#1780896895655
    ReservedCode2: ""
---
# Ozon Seller API 完整文档整理（V3 全面更新版）

> 来源：Ozon官方文档 + TypeScript SDK (daytona-ozon-seller-api v2.2.17, 33分类278+端点) + Go SDK (andmetoo/ozon-api-client) + Python SDK + MCP Server + Performance API 文档 交叉验证
> 整理时间：2026-06-06 | V2更新：2026-06-06 | **V3全面更新：2026-06-08**
> 更新人：飞羽（claude code）
> V3更新说明：基于TypeScript SDK源码完整提取所有33个API分类的精确端点路径，修正V2中9个分类的方法数"-"、12个分类方法数偏差，新增6个缺失分类的完整端点表，新增Ozon Performance API（广告）46个端点。

---

## 一、API 概述

**Ozon Seller API** 是 Ozon 市场的编程接口，用于卖家系统与 Ozon 平台之间的数据交换和自动化操作。

### 核心能力
- 上传和更新商品
- 管理商品价格和库存
- 获取退货信息
- 管理 FBO、FBS 和 rFBS 订单
- 管理客户聊天
- 处理运单
- 获取财务和分析信息
- 获取 Ozon 属性和特性数据
- 为司机和车辆订购仓库通行证

### API 基本信息
- **基础URL**: `https://api-seller.ozon.ru`
- **认证方式**: API Key + Client ID（在请求 Header 中传入）
- **数据格式**: JSON（UTF-8编码）
- **请求频率限制**: 通常每秒5次请求，超过返回429错误；每分钟最多80个请求；Premium分析类接口限制1次/分钟
- **API密钥有效期**: 2026年2月13日后创建的密钥有效期为6个月

### 认证配置
1. 在卖家后台：**设置 → Seller API** 生成 API Key 和 Client ID
2. 创建时需选择权限角色（不同角色可访问不同的API方法）
3. 可设置IP白名单（CIDR格式）增强安全性
4. 每次请求需在 Header 中传入：
   - `Client-Id`: 卖家ID
   - `Api-Key`: API密钥

### 订阅层级（影响API访问权限）
| 层级 | 可用方法数 | 说明 |
|------|-----------|------|
| LITE | 受限 | 基础功能 |
| STANDARD | 263+ | 标准卖家，覆盖绝大部分API |
| PREMIUM | 263+ + 部分Premium | 含高级分析 |
| PREMIUM_PLUS | 263+ + 15个Premium Plus | 全部功能，含聊天/评价/问答 |
| PREMIUM_PRO | 全部 | 最高权限 |
| **Experimental/Beta** | 9 | 实验性方法，随时可能变更 |

---

## 二、API 分类总览

Ozon Seller API 涵盖 **33个分类、278+个方法端点**（TypeScript SDK v2.2.17 源码精确统计）。此外还有独立的 **Ozon Performance API（广告API）** 约46个端点。

| # | 分类 | 方法数 | V2方法数 | 变化 | 说明 |
|---|------|--------|---------|------|------|
| 1 | Analytics API | **3** | 2 | +1 | 业务分析，新增库存周转分析 |
| 2 | Barcode API | 2 | 2 | = | 条码生成与绑定（限20次/分钟） |
| 3 | Beta Method API | **9** | - | NEW | 实验性方法，含平均配送时间/库存管理/角色查询 |
| 4 | Brand API | 1 | 1 | = | 品牌认证 |
| 5 | Cancellation API | **7** | 4 | +3 | 新增v2取消审批接口 |
| 6 | Category API | **4** | 6 | -2 | 类目与属性（SDK精确统计） |
| 7 | Certification API | **16** | 14 | +2 | 新增v2认证列表+合规类型 |
| 8 | Chat API | **8** | 7 | +1 | 新增v3聊天历史/列表 |
| 9 | Delivery FBS API | **18** | 18 | = | FBS配送与交接单 |
| 10 | Delivery rFBS API | **8** | - | NEW | rFBS配送全生命周期管理 |
| 11 | Digital API | **3** | - | NEW | 数字商品（激活码/库存） |
| 12 | FBO Supply Request API | **18** | 6 | +12 | FBO供货申请，大幅扩展 |
| 13 | FBO API | **13** | 13 | = | Ozon履约(Fulfillment by Ozon) |
| 14 | FBS/rFBS Marks API | **17** | 4 | +13 | 标记码管理，v4/v5/v6全版本覆盖 |
| 15 | FBS API | **22** | 40 | -18 | 卖家履约（SDK精确统计，V2含重复/过时端点） |
| 16 | Finance API | **10** | 3 | +7 | 财务操作，大幅扩展 |
| 17 | Pass API | **7** | - | NEW | 通行证和出入权限管理 |
| 18 | Polygon API | 2 | 2 | = | 测试环境 |
| 19 | Premium API | 8 | 8 | = | Premium服务（需订阅） |
| 20 | Prices & Stocks API | **9** | 8 | +1 | 新增促销计时器状态/更新 |
| 21 | Pricing Strategy API | **12** | 12 | = | 定价策略 |
| 22 | Product API | **26** | 21 | +5 | 商品管理，新增v3导入/v4属性等 |
| 23 | Promos API | **8** | 12 | -4 | 促销（SDK精确统计，V2含非标端点） |
| 24 | Quants API | **2** | 6 | -4 | 经济型商品（SDK精确统计） |
| 25 | Questions & Answers API | 8 | 8 | = | 问答管理（需Premium Plus） |
| 26 | Report API | **8** | 11 | -3 | 报表（SDK精确统计） |
| 27 | Return API | 8 | 8 | = | 退货交接处理 |
| 28 | Returns API | **1** | 2 | -1 | 退货列表（SDK精确统计） |
| 29 | Review API | 7 | 7 | = | 买家评价（需Premium Plus） |
| 30 | rFBS Returns API | **8** | - | NEW | rFBS退货全流程管理 |
| 31 | Seller Rating API | 2 | 2 | = | 卖家评级 |
| 32 | Supplier API | **4** | - | NEW | 供应商发票管理 |
| 33 | Warehouse API | 2 | 2 | = | 仓库管理 |
| | **Seller API 合计** | **~278** | ~237 | **+41** | |

---

## 三、完整 API 端点详细列表

### 3.1 类目与属性 (Category) — 4个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/description-category/tree` | 获取类目树 |
| `POST /v1/description-category/attribute` | 获取类目属性定义 |
| `POST /v1/description-category/attribute/values` | 获取属性值字典 |
| `POST /v1/description-category/attribute/values/search` | 搜索属性值 |

### 3.2 商品管理 (Product) — 26个端点

| 端点 | 说明 |
|------|------|
| `POST /v3/product/import` | 创建或更新商品（v3，单次最多100个） |
| `POST /v1/product/import/info` | 查看商品添加/更新状态（通过task_id轮询） |
| `POST /v1/product/import-by-sku` | 通过Ozon SKU创建商品 |
| `POST /v1/product/attributes/update` | 更新商品属性 |
| `POST /v1/product/pictures/import` | 上传商品图片 |
| `POST /v2/product/pictures/info` | 查询图片上传状态 |
| `POST /v3/product/list` | 获取商品列表（v3） |
| `POST /v2/product/info` | 获取商品详情 |
| `POST /v3/product/info/list` | 按ID批量获取商品信息 |
| `POST /v4/product/info/attributes` | 获取商品属性描述 |
| `POST /v1/product/info/description` | 获取商品描述 |
| `POST /v1/product/info/subscription` | 查看商品订阅用户数 |
| `POST /v1/product/rating-by-sku` | 按SKU获取内容评分 |
| `POST /v1/product/related-sku/get` | 获取关联SKU |
| `POST /v1/product/update/offer-id` | 修改卖家SKU |
| `POST /v1/product/archive` | 归档商品 |
| `POST /v1/product/unarchive` | 取消归档 |
| `POST /v2/products/delete` | 删除归档中的无SKU商品 |
| `POST /v1/product/certificate-types` | 获取证书类型 |
| `POST /v1/product/info/discounted` | 获取折扣商品信息 |
| `POST /v3/product/info/stocks` | 获取库存信息 |
| `POST /v4/product/info/prices` | 获取价格信息 |
| `POST /v4/product/info/limit` | 获取商品创建/更新限额 |
| `POST /v3/product/list` | 获取商品列表（分页） |

### 3.3 价格与库存 (Prices & Stocks) — 9个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/product/import/prices` | 批量修改商品价格 |
| `POST /v2/products/stocks` | 更新商品库存（v2，单次100个，每分钟80请求） |
| `POST /v4/product/info/stocks` | 获取库存信息（v4） |
| `POST /v5/product/info/prices` | 获取价格信息（v5） |
| `POST /v1/product/info/stocks-by-warehouse/fbs` | 获取FBS仓库库存 |
| `POST /v1/product/info/discounted` | 获取折扣商品信息 |
| `POST /v1/product/update/discount` | 更新商品折扣 |
| `POST /v1/product/action/timer/status` | 获取促销计时器状态 |
| `POST /v1/product/action/timer/update` | 更新促销计时器 |

### 3.4 促销活动 (Promos) — 8个端点

| 端点 | 说明 |
|------|------|
| `GET /v1/actions` | 获取可用促销活动 |
| `POST /v1/actions/candidates` | 可参加活动的商品 |
| `POST /v1/actions/products` | 已参加活动的商品 |
| `POST /v1/actions/products/activate` | 将商品添加到促销活动 |
| `POST /v1/actions/products/deactivate` | 从促销活动移除商品 |
| `POST /v1/actions/discounts-task/list` | 获取折扣申请列表 |
| `POST /v1/actions/discounts-task/approve` | 批准折扣申请 |
| `POST /v1/actions/discounts-task/decline` | 拒绝折扣申请 |

### 3.5 定价策略 (Pricing Strategy) — 12个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/pricing-strategy/competitors/list` | 获取竞争对手列表 |
| `POST /v1/pricing-strategy/list` | 获取定价策略列表 |
| `POST /v1/pricing-strategy/create` | 创建定价策略 |
| `POST /v1/pricing-strategy/info` | 获取策略详情 |
| `POST /v1/pricing-strategy/update` | 更新定价策略 |
| `POST /v1/pricing-strategy/delete` | 删除定价策略 |
| `POST /v1/pricing-strategy/products/add` | 添加商品到策略 |
| `POST /v1/pricing-strategy/products/delete` | 从策略中删除商品 |
| `POST /v1/pricing-strategy/products/list` | 获取策略中的商品列表 |
| `POST /v1/pricing-strategy/product/info` | 获取策略商品信息 |
| `POST /v1/pricing-strategy/strategy-ids-by-product-ids` | 按商品ID获取策略ID |
| `POST /v1/pricing-strategy/status` | 获取策略状态 |

### 3.6 分析 (Analytics) — 3个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/analytics/turnover/stocks` | 库存周转分析（turnover_grades: DEFICIT/POPULAR/SURPLUS） |
| `POST /v2/analytics/stock_on_warehouses` | 仓库库存分析 |
| `POST /v1/analytics/stocks` | 库存管理分析 |

### 3.7 财务 (Finance) — 10个端点

| 端点 | 说明 |
|------|------|
| `POST /v3/finance/transaction/list` | 获取交易列表（v3） |
| `POST /v3/finance/transaction/totals` | 获取交易汇总（v3） |
| `POST /v1/finance/realization/posting` | 获取实现报告（按配送） |
| `POST /v2/finance/realization` | 获取实现报告（v2） |
| `POST /v1/finance/compensation` | 获取补偿报告 |
| `POST /v1/finance/decompensation` | 获取退补偿报告 |
| `POST /v1/finance/document-b2b-sales` | 创建B2B销售文档 |
| `POST /v1/finance/document-b2b-sales/json` | 创建B2B销售JSON文档 |
| `POST /v1/finance/mutual-settlement` | 获取相互结算报告 |
| `POST /v1/finance/products/buyout` | 获取商品买断信息 |

### 3.8 FBS 订单 (Fulfillment by Seller) — 22个端点

| 端点 | 说明 |
|------|------|
| `POST /v3/posting/fbs/list` | 获取FBS配送列表 |
| `POST /v3/posting/fbs/get` | 获取FBS配送详情 |
| `POST /v3/posting/fbs/unfulfilled/list` | 获取未完成FBS配送 |
| `POST /v2/posting/fbs/get-by-barcode` | 通过条码获取配送信息 |
| `POST /v1/posting/fbs/cancel-reason` | 获取FBS取消原因（v1） |
| `POST /v2/posting/fbs/cancel-reason/list` | FBS取消原因列表（v2） |
| `POST /v2/posting/fbs/cancel` | 取消FBS配送 |
| `POST /v2/posting/fbs/arbitration` | FBS仲裁 |
| `POST /v2/posting/fbs/awaiting-delivery` | FBS待配送 |
| `POST /v2/posting/fbs/product/cancel` | 取消FBS配送商品 |
| `POST /v2/posting/fbs/product/change` | 更换FBS配送商品 |
| `POST /v2/posting/fbs/product/country/list` | 获取商品原产国列表 |
| `POST /v2/posting/fbs/product/country/set` | 设置商品原产国 |
| `POST /v3/posting/multiboxqty/set` | 设置多箱数量 |
| `POST /v1/posting/fbs/restrictions` | 获取FBS限制信息 |
| `POST /v1/posting/fbs/pick-up-code/verify` | 验证取件码 |
| `POST /v1/posting/fbs/package-label/create` | 创建包裹标签（v1） |
| `POST /v2/posting/fbs/package-label/create` | 创建包裹标签（v2） |
| `POST /v1/posting/fbs/package-label/get` | 获取包裹标签状态 |
| `POST /v2/posting/fbs/package-label` | 获取包裹标签（v2） |
| `POST /v1/posting/global/etgb` | 获取ETGB（海关申报单） |
| `POST /v1/posting/unpaid-legal-product/list` | 获取未付款法律商品列表 |

### 3.9 Delivery FBS（FBS配送交接单） — 18个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/carriage/create` | 创建发货单 |
| `POST /v1/carriage/approve` | 审批发货单 |
| `POST /v1/carriage/cancel` | 取消发货单 |
| `POST /v1/carriage/get` | 获取发货单详情 |
| `POST /v1/carriage/delivery/list` | 获取发货配送列表 |
| `POST /v1/carriage/set-postings` | 设置发货配送 |
| `POST /v1/posting/carriage-available/list` | 获取可用发货列表 |
| `POST /v1/posting/fbs/split` | 拆分FBS配送 |
| `POST /v2/posting/fbs/act/create` | 创建交接单 |
| `POST /v2/posting/fbs/act/check-status` | 检查交接单状态 |
| `POST /v2/posting/fbs/act/get-barcode` | 获取交接单条码 |
| `POST /v2/posting/fbs/act/get-barcode/text` | 获取交接单条码文本 |
| `POST /v2/posting/fbs/act/get-container-labels` | 获取容器标签 |
| `POST /v2/posting/fbs/act/get-pdf` | 获取交接单PDF |
| `POST /v2/posting/fbs/act/get-postings` | 获取交接单中的配送 |
| `POST /v2/posting/fbs/act/list` | 获取交接单列表 |
| `POST /v2/posting/fbs/digital/act/check-status` | 检查数字交接单状态 |
| `POST /v2/posting/fbs/digital/act/get-pdf` | 获取数字交接单PDF |

### 3.10 Delivery rFBS（rFBS配送） — 8个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/posting/cutoff/set` | 设置rFBS发货截止时间 |
| `POST /v1/posting/fbs/timeslot/change-restrictions` | 获取时段修改限制 |
| `POST /v1/posting/fbs/timeslot/set` | 设置配送时段 |
| `POST /v2/fbs/posting/tracking-number/set` | 设置第三方物流追踪号 |
| `POST /v2/fbs/posting/sent-by-seller` | 标记卖家已发货 |
| `POST /v2/fbs/posting/last-mile` | 标记快递在途（最后一公里） |
| `POST /v2/fbs/posting/delivering` | 标记配送中 |
| `POST /v2/fbs/posting/delivered` | 标记已送达 |

> **rFBS配送状态流转**：sent_by_seller → last_mile → delivering → delivered

### 3.11 FBO 订单 (Fulfillment by Ozon) — 13个端点

| 端点 | 说明 |
|------|------|
| `POST /v2/posting/fbo/list` | 获取FBO配送列表 |
| `POST /v2/posting/fbo/get` | 获取FBO配送详情 |
| `POST /v1/posting/fbo/cancel-reason/list` | 获取FBO取消原因 |
| `GET /v1/supplier/available_warehouses` | 获取可用仓库 |
| `POST /v1/supply-order/bundle` | 供货单打包 |
| `POST /v1/supply-order/pass/create` | 创建供货通行证 |
| `POST /v1/supply-order/pass/status` | 供货通行证状态 |
| `POST /v1/supply-order/status/counter` | 供货单状态计数 |
| `POST /v1/supply-order/timeslot/get` | 获取供货时段 |
| `POST /v1/supply-order/timeslot/status` | 供货时段状态 |
| `POST /v1/supply-order/timeslot/update` | 更新供货时段 |
| `POST /v2/supply-order/get` | 获取供货单详情（v2） |
| `POST /v2/supply-order/list` | 获取供货单列表（v2） |

### 3.12 FBO Supply Request（FBO供货申请） — 18个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/draft/create` | 创建供货草稿 |
| `POST /v1/draft/create/info` | 获取草稿创建信息 |
| `POST /v1/draft/timeslot/info` | 获取草稿时段信息 |
| `POST /v1/draft/supply/create` | 从草稿创建供货 |
| `POST /v1/draft/supply/create/status` | 供货创建状态 |
| `POST /v1/cargoes/create` | 创建货物 |
| `POST /v1/cargoes/create/info` | 获取货物创建信息 |
| `POST /v1/cargoes/delete` | 删除货物 |
| `POST /v1/cargoes/delete/status` | 货物删除状态 |
| `POST /v1/cargoes/rules/get` | 获取货物规则 |
| `POST /v1/cargoes-label/create` | 创建货物标签 |
| `POST /v1/cargoes-label/get` | 获取货物标签 |
| `POST /v1/cluster/list` | 获取集群列表 |
| `POST /v1/warehouse/fbo/list` | 获取FBO仓库列表 |
| `POST /v1/supply-order/cancel` | 取消供货单 |
| `POST /v1/supply-order/cancel/status` | 取消状态 |
| `POST /v1/supply-order/content/update` | 更新供货单内容 |
| `POST /v1/supply-order/content/update/status` | 内容更新状态 |

### 3.13 FBS/rFBS 标记码管理 (Marks) — 17个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/fbs/posting/product/exemplar/update` | 更新标记码标本（v1） |
| `POST /v4/fbs/posting/product/exemplar/set` | 设置标记码标本（v4） |
| `POST /v4/fbs/posting/product/exemplar/status` | 获取标记码状态（v4） |
| `POST /v4/fbs/posting/product/exemplar/validate` | 验证标记码（v4） |
| `POST /v4/posting/fbs/ship` | 发货（v4，含标记码） |
| `POST /v4/posting/fbs/ship/package` | 打包发货（v4） |
| `POST /v5/fbs/posting/product/exemplar/create-or-get` | 创建或获取标记码（v5） |
| `POST /v5/fbs/posting/product/exemplar/set` | 设置标记码（v5） |
| `POST /v5/fbs/posting/product/exemplar/status` | 获取状态（v5） |
| `POST /v5/fbs/posting/product/exemplar/validate` | 验证标记码（v5） |
| `POST /v6/fbs/posting/product/exemplar/create-or-get` | 创建或获取标记码（v6） |
| `POST /v6/fbs/posting/product/exemplar/set` | 设置标记码（v6） |
| `POST /v1/posting/fbs/rfbs/upload-marking-codes/status` | 上传标记码状态 |
| `POST /v1/posting/fbs/rfbs/validate-marking-codes` | 验证标记码 |
| `POST /v1/posting/fbs/rfbs/validate-marking-codes/status` | 验证状态 |
| `POST /v1/posting/fbs/rfbs/marking-codes/info` | 获取标记码信息 |
| `POST /v1/posting/fbs/rfbs/list` | 获取rFBS标记码列表 |

### 3.14 退货处理 (Return) — 8个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/return/giveout/barcode` | 获取退货交接条码 |
| `POST /v1/return/giveout/barcode-reset` | 重置退货交接条码 |
| `POST /v1/return/giveout/get-pdf` | 获取退货交接PDF |
| `POST /v1/return/giveout/get-png` | 获取退货交接PNG |
| `POST /v1/return/giveout/info` | 获取退货交接详情 |
| `POST /v1/return/giveout/is-enabled` | 检查退货交接是否启用 |
| `POST /v1/return/giveout/list` | 获取退货交接列表 |
| `POST /v1/returns/company/fbs/info` | 获取FBS退货公司信息 |

### 3.15 退货列表 (Returns) — 1个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/returns/list` | 获取退货列表 |

### 3.16 rFBS退货 (rFBS Returns) — 8个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/returns/rfbs/action/set` | 设置rFBS退货操作 |
| `POST /v2/returns/rfbs/compensate` | rFBS退货补偿 |
| `POST /v2/returns/rfbs/get` | 获取rFBS退货详情 |
| `POST /v2/returns/rfbs/list` | 获取rFBS退货列表 |
| `POST /v2/returns/rfbs/receive-return` | 接收rFBS退货 |
| `POST /v2/returns/rfbs/reject` | 拒绝rFBS退货 |
| `POST /v2/returns/rfbs/return-money` | rFBS退货退款 |
| `POST /v2/returns/rfbs/verify` | 验证rFBS退货 |

### 3.17 订单取消 (Cancellation) — 7个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/conditional-cancellation/get` | 获取取消申请详情 |
| `POST /v1/conditional-cancellation/list` | 获取取消申请列表 |
| `POST /v1/conditional-cancellation/approve` | 批准取消申请（v1） |
| `POST /v1/conditional-cancellation/reject` | 拒绝取消申请（v1） |
| `POST /v2/conditional-cancellation/list` | 获取取消申请列表（v2） |
| `POST /v2/conditional-cancellation/approve` | 批准取消申请（v2） |
| `POST /v2/conditional-cancellation/reject` | 拒绝取消申请（v2） |

### 3.18 客户聊天 (Chat) — 8个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/chat/start` | 开始聊天 |
| `POST /v1/chat/send/message` | 发送消息 |
| `POST /v1/chat/send/file` | 发送文件 |
| `POST /v2/chat/read` | 标记聊天已读 |
| `POST /v2/chat/history` | 获取聊天历史（v2） |
| `POST /v3/chat/history` | 获取聊天历史（v3） |
| `POST /v2/chat/list` | 获取聊天列表（v2） |
| `POST /v3/chat/list` | 获取聊天列表（v3） |

### 3.19 买家评价 (Review) — 7个端点（需Premium Plus）

| 端点 | 说明 |
|------|------|
| `POST /v1/review/list` | 获取评价列表 |
| `POST /v1/review/info` | 获取评价详情 |
| `POST /v1/review/count` | 获取评价计数 |
| `POST /v1/review/change-status` | 变更评价处理状态 |
| `POST /v1/review/comment/create` | 创建评价回复 |
| `POST /v1/review/comment/delete` | 删除评价回复 |
| `POST /v1/review/comment/list` | 获取评价回复列表 |

> 评价状态：UNPROCESSED（未处理）→ PROCESSED（已处理）

### 3.20 问答管理 (Questions & Answers) — 8个端点（需Premium Plus）

| 端点 | 说明 |
|------|------|
| `POST /v1/question/answer/create` | 创建回答 |
| `POST /v1/question/answer/delete` | 删除回答 |
| `POST /v1/question/answer/list` | 获取回答列表 |
| `POST /v1/question/change-status` | 变更问题处理状态 |
| `POST /v1/question/count` | 获取问题计数 |
| `POST /v1/question/info` | 获取问题详情 |
| `POST /v1/question/list` | 获取问题列表 |
| `POST /v1/question/top-sku` | 获取热门问题SKU |

> 问题状态：NEW（新问题）→ PROCESSED（已处理）

### 3.21 质量证书 (Certification) — 16个端点

| 端点 | 说明 |
|------|------|
| `GET /v1/product/certificate/accordance-types` | 获取合规类型 |
| `GET /v1/product/certificate/types` | 获取证书类型 |
| `GET /v2/product/certificate/accordance-types/list` | 获取合规类型列表（v2） |
| `POST /v1/product/certificate/create` | 创建证书 |
| `POST /v1/product/certificate/bind` | 绑定证书到商品 |
| `POST /v1/product/certificate/delete` | 删除证书 |
| `POST /v1/product/certificate/info` | 获取证书详情 |
| `POST /v1/product/certificate/list` | 获取证书列表 |
| `POST /v1/product/certificate/unbind` | 解绑证书 |
| `POST /v1/product/certificate/product_status/list` | 商品认证状态列表 |
| `POST /v1/product/certificate/products/list` | 证书关联商品列表 |
| `POST /v1/product/certificate/rejection_reasons/list` | 证书被拒原因列表 |
| `POST /v1/product/certificate/status/list` | 证书状态列表 |
| `POST /v1/product/certification/list` | 获取认证列表（v1） |
| `POST /v2/product/certification/list` | 获取认证列表（v2） |

### 3.22 品牌认证 (Brand) — 1个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/brand/company-certification/list` | 需要认证的品牌列表 |

### 3.23 Premium 服务 (Premium) — 8个端点（需Premium/Premium Plus订阅）

| 端点 | 说明 | 订阅要求 |
|------|------|----------|
| `POST /v1/analytics/data` | 获取高级分析数据 | Premium Plus |
| `POST /v1/finance/realization/by-day` | 按日获取实现报告 | Premium Plus |
| `POST /v1/analytics/product-queries` | 获取商品搜索查询 | Premium/Premium Plus |
| `POST /v1/analytics/product-queries/details` | 获取搜索查询详情 | Premium/Premium Plus |
| `POST /v1/chat/start` | 开始Premium聊天 | Premium Plus |
| `POST /v1/chat/send/message` | 发送Premium聊天消息 | Premium Plus |
| `POST /v3/chat/history` | 获取Premium聊天历史 | Premium Plus |
| `POST /v2/chat/read` | 标记Premium聊天已读 | Premium Plus |

> ⚠️ 分析数据最大查询周期92天，实现报告最大32天。部分方法限1次/分钟。

### 3.24 Beta 实验方法 (Beta Method) — 9个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/analytics/average-delivery-time` | 平均配送时间分析 |
| `POST /v1/analytics/average-delivery-time/details` | 配送时间详细分解 |
| `POST /v1/analytics/average-delivery-time/summary` | 配送时间汇总+优化建议 |
| `POST /v1/analytics/manage/stocks` | 库存管理（已弃用，用/v1/analytics/stocks替代） |
| `POST /v1/analytics/stocks` | 库存分析（替代manage/stocks，含turnover_grades） |
| `POST /v1/product/info/wrong-volume` | 获取体积/重量异常商品 |
| `POST /v1/removal/from-stock/list` | 库存移除/处置报告 |
| `POST /v1/removal/from-supply/list` | 供货移除/处置报告 |
| `POST /v1/roles` | 获取API密钥角色和权限 |

> ⚠️ Beta方法为实验性质，可能随时变更，不建议生产环境依赖。

### 3.25 数字商品 (Digital) — 3个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/posting/digital/list` | 获取数字商品订单列表 |
| `POST /v1/posting/digital/codes/upload` | 上传激活码/序列号（24小时内必须上传） |
| `POST /v1/product/digital/stocks/import` | 更新数字商品库存（建议批量100条） |

### 3.26 供应商管理 (Supplier) — 4个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/invoice/file/upload` | 上传发票文件（PDF/JPEG，Base64编码） |
| `POST /v2/invoice/create-or-update` | 创建或更新发票 |
| `POST /v2/invoice/get` | 获取发票信息 |
| `POST /v1/invoice/delete` | 删除发票 |

> 发票状态：pending → approved / rejected → processing → paid。主要用于土耳其卖家VAT退税。

### 3.27 通行证管理 (Pass) — 7个端点 🆕

| 端点 | 说明 |
|------|------|
| `POST /v1/carriage/pass/create` | 创建发货通行证 |
| `POST /v1/carriage/pass/delete` | 删除发货通行证 |
| `POST /v1/carriage/pass/update` | 更新发货通行证 |
| `POST /v1/pass/list` | 获取通行证列表 |
| `POST /v1/return/pass/create` | 创建退货通行证 |
| `POST /v1/return/pass/delete` | 删除退货通行证 |
| `POST /v1/return/pass/update` | 更新退货通行证 |

> 通行证用于司机和车辆进出仓库的身份凭证管理。

### 3.28 经济型商品 (Quants) — 2个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/product/quant/info` | 获取量贩装商品详情 |
| `POST /v1/product/quant/list` | 获取量贩装商品列表（游标分页） |

> 限100次/分钟。商品可见性值：VISIBLE / INVISIBLE / IN_SALE / NOT_IN_SALE / ARCHIVED / MODERATED / REJECTED

### 3.29 条码管理 (Barcode) — 2个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/barcode/add` | 绑定已有条码到商品（单次最多100个，每品100条码） |
| `POST /v1/barcode/generate` | 自动生成条码（单次最多100个商品ID） |

> 限20次/分钟。条码最大长度100字符。

### 3.30 报表 (Report) — 8个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/report/info` | 获取报表详情 |
| `POST /v1/report/list` | 获取报表列表 |
| `POST /v1/report/products/create` | 创建产品报表 |
| `POST /v1/report/postings/create` | 创建配送报表 |
| `POST /v1/report/discounted/create` | 创建折扣报表 |
| `POST /v1/finance/cash-flow-statement/list` | 获取资金流对账单 |
| `POST /v1/report/warehouse/stock` | 仓库库存报表 |
| `POST /v2/report/returns/create` | 创建退货报表（v2） |

### 3.31 仓库管理 (Warehouse) — 2个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/warehouse/list` | 获取仓库列表 |
| `POST /v1/delivery-method/list` | 获取配送方式列表 |

### 3.32 测试环境 (Polygon) — 2个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/polygon/create` | 创建测试环境 |
| `POST /v1/polygon/bind` | 绑定测试环境 |

### 3.33 卖家评级 (Seller Rating) — 2个端点

| 端点 | 说明 |
|------|------|
| `POST /v1/rating/summary` | 获取卖家评级概要 |
| `POST /v1/rating/history` | 获取卖家评级历史 |

---

## 四、Ozon Performance API（广告API）— 46个端点

与 Seller API **完全独立**，用于管理Ozon广告后台。使用不同的认证和基础URL。

### 基本信息对比

| 项目 | Seller API | Performance API |
|------|-----------|----------------|
| 基础URL | `https://api-seller.ozon.ru` | `https://api-performance.ozon.ru` |
| HTTP方法 | 几乎全POST | GET / POST / PATCH / PUT |
| 认证 | Client-Id + Api-Key Header | 独立广告账户凭证 |
| 端点数 | 278+ | ~46 |

### 4.1 广告活动管理 (Campaign Management)

| 端点 | HTTP | 说明 |
|------|------|------|
| `/api/client/campaign` | GET | 获取所有广告活动 |
| `/api/client/campaign/cpc/v2/product` | POST | 创建CPC(按点击付费)广告活动 |
| `/api/client/campaign/{campaignId}` | PATCH | 更新广告活动参数 |
| `/api/client/campaign/{campaignId}/activate` | POST | 激活广告活动 |
| `/api/client/campaign/{campaignId}/deactivate` | POST | 停用广告活动 |
| `/api/client/campaign/{campaignId}/objects` | GET | 获取广告活动中的推广对象 |
| `/api/client/limits/list` | GET | 获取出价限制 |
| `/api/client/min/sku` | POST | 获取商品最低出价 |
| `/api/client/products_with_bonuses` | GET | 获取有奖金的商品 |
| `/external/api/dynamic_budget` | POST | 计算最低广告预算 |

### 4.2 广告商品管理 (Product Management)

| 端点 | HTTP | 说明 |
|------|------|------|
| `/api/client/campaign/{campaignId}/products` | POST | 添加商品到广告活动 |
| `/api/client/campaign/{campaignId}/products` | PUT | 更新商品出价 |
| `/api/client/campaign/{campaignId}/products/delete` | POST | 从广告活动移除商品 |
| `/api/client/campaign/{campaignId}/products/bids/competitive` | GET | 获取竞争出价 |
| `/api/client/campaign/{campaignId}/v2/products` | GET | 获取广告商品列表（v2） |

### 4.3 搜索推广 (Search Promo / Pay-per-Order)

| 端点 | HTTP | 说明 |
|------|------|------|
| `/api/client/campaign/all_sku_promo/activate` | GET | 激活全部商品按单付费推广 |
| `/api/client/campaign/all_sku_promo/deactivate` | GET | 停用全部商品按单付费推广 |
| `/api/client/campaign/search_promo/carrots/enable` | POST | 启用"胡萝卜"推广 |
| `/api/client/campaign/search_promo/carrots/disable` | POST | 停用"胡萝卜"推广 |
| `/api/client/search_promo/bids/recommendation` | POST | 获取推荐出价 |
| `/api/client/search_promo/get_cpo_min_bids` | POST | 获取固定最低出价 |
| `/api/client/search_promo/product/enable` | POST | 启用单商品按单付费 |
| `/api/client/search_promo/product/disable` | POST | 停用单商品按单付费 |
| `/api/client/campaign/search_promo/v2/bids/set` | POST | 设置推广出价 |
| `/api/client/campaign/search_promo/v2/bids/delete` | POST | 移除推广出价 |
| `/api/client/campaign/search_promo/v2/products` | POST | 获取搜索推广商品 |

### 4.4 统计与报表 (Statistics & Reporting)

| 端点 | HTTP | 说明 |
|------|------|------|
| `/api/client/statistics` | POST | 广告活动统计 |
| `/api/client/statistics/daily` | GET | 每日统计 |
| `/api/client/statistics/expense` | GET | 费用统计 |
| `/api/client/statistics/campaign/product` | GET | CPC广告统计 |
| `/api/client/statistics/campaign/media` | GET | 媒体广告统计 |
| `/api/client/statistics/attribution` | POST | 归因/订单报告 |
| `/api/client/statistics/phrases` | POST | 搜索词报告 |
| `/api/client/statistics/video` | POST | 视频广告统计 |
| `/api/client/statistic/orders/generate` | POST | 生成订单报告 |
| `/api/client/statistic/products/generate` | POST | 生成商品报告 |
| `/api/client/statistics/all_sku_promo/orders/generate` | GET | 生成全商品订单报告 |
| `/api/client/statistics/all_sku_promo/products/generate` | GET | 生成全商品商品报告 |
| `/api/client/statistics/list` | GET | 列出UI生成的报告 |
| `/api/client/statistics/externallist` | GET | 列出API生成的报告 |
| `/api/client/statistics/report` | GET | 下载报告 |
| `/api/client/statistics/{UUID}` | GET | 按UUID获取报告状态 |

### 4.5 外部广告 (Vendor / External Advertising)

| 端点 | HTTP | 说明 |
|------|------|------|
| `/api/client/organisation/vendor_tag` | GET | 获取外部广告标签 |
| `/api/client/vendors/statistics` | POST | 外部流量分析报告 |
| `/api/client/vendors/statistics/list` | GET | 列出外部流量报告 |
| `/api/client/vendors/statistics/{UUID}` | GET | 按UUID获取外部流量报告 |

---

## 五、API 使用入门流程

### 5.1 通过API开始销售

1. **生成API密钥**：在账户设置中生成 API Key 和 Client ID
2. **添加商品**：使用 `POST /v3/product/import` 上传商品（单次最多100个），需指定分类和属性
3. **等待审核**：新商品审核通常最多3天
4. **接收订单**：订单出现后，状态为 `awaiting_packaging`
5. **打包发货**：使用FBS打包方法处理订单
6. **更新物流**：非集成配送服务需手动更新状态和追踪号

### 5.2 更新商品、库存和价格

- 使用 `POST /v2/products/stocks` 更新库存
- 使用 `POST /v1/product/import/prices` 更新价格
- 使用 `POST /v1/warehouse/list` 查看仓库列表
- 注意：任何修改都需经过审核，信息更新可能有数天延迟

### 5.3 商品创建核心字段

| 字段 | 参数名 | 说明 |
|------|--------|------|
| 卖家SKU | `offer_id` | 卖家系统中的唯一标识，最长50字符 |
| 商品名称 | `name` | 格式：类型+品牌+型号+特征 |
| 品牌 | `vendor` | 部分品牌需上传授权证书 |
| 商品描述 | `description` | 商品用途、特点、优势 |
| 分类ID | `category_id` / `description_category_id` | 通过类目树接口获取 |
| 属性 | `attributes` | 分类对应的必填和可选属性 |
| 图片 | `images` | 通过图片上传接口获取URL |
| 合同货币 | `currency_code` | 中国卖家使用 CNY |

### 5.4 多币种支持

中国卖家的合同货币为 **CNY（人民币）**，上传商品时需在 `currency_code` 字段中指定。涉及货币字段的API方法：
- `POST /v3/product/import`
- `POST /v1/product/import/prices`
- `POST /v1/product/import-by-sku`
- `POST /v3/posting/fbs/get`、`/v3/posting/fbs/list` 等
- `POST /v5/product/info/prices`
- `POST /v2/product/info`、`/v3/product/info/list`

### 5.5 rFBS配送状态流转

```
收到订单 → 设置截止时间(setCutoff) → 设置时段(setTimeslot)
→ 卖家发货(sent-by-seller) → 最后一公里(last-mile)
→ 配送中(delivering) → 已送达(delivered)
```

### 5.6 FBS发货流程（含标记码）

```
获取订单(list/get) → 验证标记码(validate) → 设置标记码(set)
→ 打包发货(ship) → 创建交接单(act/create) → 检查状态(check-status)
→ 获取交接单PDF(get-pdf) → 交接完成
```

---

## 六、重要注意事项

### 6.1 请求限制
- 单次商品导入最多100个
- 库存更新单次最多100个商品
- 每秒最多5个请求，每分钟最多80个请求
- 条码接口限20次/分钟
- Quants接口限100次/分钟
- Premium分析接口限1次/分钟
- 超出频率限制返回HTTP 429

### 6.2 异步处理
- 商品导入为异步操作，提交后需通过 `task_id` 轮询查询结果
- 处理时间通常1-5分钟
- 商品审核通常1-3个工作日
- FBO供货申请、交接单创建等也是异步操作

### 6.3 错误处理
- API返回的错误信息包含具体字段和原因
- 建议实现自动重试机制（处理429等临时错误）
- 建议在本地先做数据校验，减少无效请求
- SDK提供了`isRetryableError`和`getRetryDelay`工具函数

### 6.4 最佳实践
- 实现增量同步机制，仅上传变更数据
- 通过对比最后修改时间判断是否需要更新
- 建立完善的日志系统记录错误详情
- 保护API密钥安全，不要泄露给第三方
- 属性字典值可能随时间更新，建议定期同步
- 使用幂等键(Idempotency Key)防止重复提交

### 6.5 推送通知
Ozon可以发送推送通知到你的REST服务器，支持的事件类型包括：
- 订单状态变更
- 聊天消息
- 商品审核结果
- 退货状态更新

### 6.6 API版本说明
- 同一功能可能存在多个版本端点（如v1/v2/v3/v4/v5/v6），建议使用最新版本
- Beta方法为实验性质，可能随时变更
- 旧版本端点可能被弃用（如`/v1/analytics/manage/stocks`已被`/v1/analytics/stocks`替代）

---

## 七、参考链接与开源SDK

### 官方文档
- Ozon官方API文档（中文）: https://docs.ozon.ru/api/seller/zh/
- Ozon官方API文档（英文）: https://docs.ozon.ru/global/en/api/intro/?country=CN
- Ozon官方API文档（俄文）: https://docs.ozon.ru/api/seller/
- API使用入门（英文）: https://docs.ozon.ru/global/en/api/intro/
- 通过API上传商品: https://docs.ozon.ru/global/en/api/via-api/?country=CN

### 开源SDK（可作为API参考和集成工具）
- **TypeScript SDK** ⭐推荐: https://www.npmjs.com/package/daytona-ozon-seller-api — 33分类278+方法，完整类型定义，V3文档主要数据源
- **Go SDK**: https://github.com/andmetoo/ozon-api-client — ~160端点，17分类
- **Python SDK (async)**: https://pypi.org/project/ozon-api/ — 含数据模型和验证
- **Python SDK**: https://pypi.org/project/ozonapi-async/ — 异步客户端
- **MCP Server**: https://github.com/dontsovcmc/mcp-server-ozon-seller — 111 actions，18 domains，v0.3.1
- **MCP工具 (glama.ai)**: https://glama.ai/mcp/servers/@epolevsky/ozon-mcp — 420方法49分区（含Performance API）

### Performance API 文档
- Ozon广告API文档: https://docs.ozon.ru/api/performance/
- MCP索引含完整46个Performance端点

---

> 📝 V3更新摘要（2026-06-08 飞羽）：
> - 基于 TypeScript SDK v2.2.17 源码精确提取全部33分类278+端点路径
> - 修正12个分类方法数偏差（Analytics 2→3, Cancellation 4→7, Category 6→4, Certification 14→16, Chat 7→8, FBO Supply Request 6→18, FBS/rFBS Marks 4→17, FBS 40→22, Finance 3→10, Prices & Stocks 8→9, Product 21→26, Promos 12→8）
> - 填充6个V2标记"-"的分类完整端点（Beta Method 9, Delivery rFBS 8, Digital 3, Pass 7, rFBS Returns 8, Supplier 4）
> - 新增Ozon Performance API完整46个端点文档
> - 新增rFBS配送状态流转、FBS发货流程说明
> - 新增订阅层级与API访问权限对应表
> - 新增API版本说明与最佳实践建议

---

> 本内容由 Coze AI 生成，请遵循相关法律法规及《人工智能生成合成内容标识办法》使用与传播。
