# 项目上下文

## 项目概述

**Ozon ERP 电商管理系统** - 集成订单处理、智能采购、供应链管理的跨境电商ERP系统。

### 核心业务模式
- **零库存优先**：出单后采购，热销产品可选备货
- **人机协同绑定**：人工外部平台下单 + 系统内部绑定
- **硬件强集成**：扫描枪、电子秤是核心触发器
- **利润后置核算**：售后期结束后计算真实净利润

### 业务流程
```
订单同步 → 待采购 → 人工下单 → 绑定录入 → 入库验货 → 打包发货 → 利润核算
```

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 功能模块

| 模块 | 页面 | 说明 |
|------|------|------|
| 登录 | login | 手机号验证码登录 |
| 仪表盘 | dashboard | 业务流程可视化、核心指标、硬件状态 |
| 采购管理 | purchase | **订单同步、待采购订单、采购任务、人机协同绑定** |
| 快捷录单 | quick-entry | 三种录入方式、校验逻辑 |
| 入库验货 | logistics | 扫描枪集成、验货流程、异常工单 |
| 打包发货 | packaging | 电子秤集成、Ozon面单打印 |
| 利润核算 | finance | 售后期结束后计算真实净利润 |
| 库存管理 | inventory | 轻量化库存、备货建议 |
| 仓库管理 | wms | 智能盘点、库位推荐 |
| SKU管理 | sku-management | SKU主数据、货源映射 |
| 供应商管理 | suppliers | 供应商档案、采购历史 |
| 数据报表 | reports | 经营报表、采购报表、效率报表 |
| 账号管理 | accounts | 子账号、角色分配 |
| 角色权限 | roles | 权限等级、菜单权限 |
| 系统设置 | settings | 平台账号、多店铺绑定 |

## API 文档

- **Ozon API**: [docs/OZON_API.md](docs/OZON_API.md) - Ozon Seller API 接口文档
- **认证方式**: Client-Id + Api-Key
- **基础URL**: https://api-seller.ozon.ru

### 市场信号 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/market-signals/batch` | POST | 批量推送采集数据 |
| `/api/market-signals` | GET | 查询市场信号列表 |
| `/api/market-signals/stats` | GET | 采集统计 |
| `/api/market-signals/collected-ids` | GET | 获取已采集ID列表 |

### 采集箱 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/collection-items` | GET | 采集箱列表 |
| `/api/collection-items` | POST | 创建采集箱项 |
| `/api/collection-items/:id` | GET/PUT/DELETE | 采集箱项CRUD |
| `/api/collection-items/:id/claim` | PATCH | 认领采集箱项 |
| `/api/collection-items/batch-claim` | POST | 批量认领 |
| `/api/collection-items/batch-publish` | POST | 批量发布到Ozon |
| `/api/collection-items/stats` | GET | 采集箱统计 |

### 关键词 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/keywords/reverse` | GET | 关键词反查（根据商品ID获取关联关键词） |
| `/api/keywords/mining` | GET | 关键词挖掘（输入种子词获取相关关键词） |

#### 关键词反查API详情
```
GET /api/keywords/reverse?productId=xxx&platform=ozon
```
- **数据源**：从商品标题/类目路径分词提取
- **返回格式**：keyword, searchVolume, competition, competitionValue, rank, source
- **缓存**：查询结果缓存到keyword_reverse表
- **来源优先级**：title > tag > category

#### 关键词挖掘API详情
```
GET /api/keywords/mining?seed=xxx&platform=ozon&limit=50
```
- **数据源**：从market_signals表的title/categoryPath聚合统计
- **返回格式**：keyword, monthlySearch, monthlyGrowth, competitorCount, productCount, marketSpace
- **挖掘逻辑**：基于种子词在商品标题/类目中匹配，聚合统计搜索量/增长率/竞对数
- **市场空间**：marketSpace = monthlySearch / productCount（搜索量/商品数比值）

### 产品发布 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/products/publish` | POST | 发布商品到Ozon |

### 利润计算 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/profit-calculator` | POST | 计算利润和ROI |

### Dashboard API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard` | GET | ERP仪表盘（订单/采购/物流/店铺数据） |
| `/api/dashboard/market-overview` | GET | 市场概览（总商品/新增/价格变化/热销类目/销量趋势） |
| `/api/dashboard/category-ranking` | GET | 类目排行（按营收排序） |
| `/api/dashboard/search-trending` | GET | 搜索飙升关键词（基于标题词频分析） |
| `/api/dashboard/new-arrivals` | GET | 新品榜（按上架日期筛选） |

### 选品推荐 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/selection/recommend` | GET | 推荐模式查询（销量飙升/潜力市场/未被满足/不压库存） |

### 选品推荐模式参数
```
GET /api/selection/recommend?mode=surge&platform=ozon&page=1&pageSize=20
```
- **mode**: surge（销量飙升榜）| potential（潜力市场）| unsatisfied（未被满足）| low-stock（不压库存）
- **platform**: ozon | wb
- **缓存**: 10分钟

### 产品库 API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/product-groups` | GET/POST | 获取/创建分组 |
| `/api/product-groups/[id]` | GET/PUT/DELETE | 单个分组CRUD |
| `/api/product-library` | GET/POST | 获取/添加商品 |
| `/api/product-library/batch` | POST/DELETE/PATCH | 批量添加/删除/移动 |

### 数据库表
- `product_groups`: 产品分组表
- `product_group_items`: 分组商品关联表

## 硬件集成

| 硬件 | 用途 | 数据协议 |
|------|------|----------|
| 扫描枪 | 入库验货、库位扫描 | 模拟键盘输入，扫描结束自动触发 |
| 电子秤 | 打包称重 | 串口/USB HID，格式：WEIGHT:XX.XXkg |
| 打印机 | 面单打印 | 系统打印API，PDF直接打印 |

## Chrome 插件 (ozon-extension)

### 概述
Chrome扩展插件，用于在Ozon/WB网站注入数据采集面板和导航栏。

### 目录结构
```
ozon-extension/
├── public/
│   └── manifest.json        # Chrome扩展清单
├── src/
│   ├── background/          # Service Worker
│   │   └── service-worker.ts
│   ├── content/             # Content Script
│   │   ├── main.ts         # 主入口（协调各组件）
│   │   ├── navbar.ts       # 导航栏组件
│   │   ├── overlay.ts      # 数据面板组件
│   │   ├── keywords-panel.ts # 关键词面板组件
│   │   ├── selection.ts    # 选品模式组件
│   │   ├── helpers.ts      # 辅助元素组件
│   │   ├── ozon.ts        # Ozon平台提取器
│   │   ├── wb.ts          # WB平台提取器
│   │   ├── preview.ts      # 采集预览面板
│   │   └── collected-store.ts # 已采集状态管理
│   ├── popup/              # 插件弹窗
│   │   └── App.tsx
│   └── shared/             # 共享代码
│       ├── types.ts        # 类型定义
│       ├── message-bus.ts  # 消息总线
│       └── store.ts        # 状态管理
├── package.json
└── vite.config.ts
```

### 插件版本
- **v1.1.0**: 初始版本，导航栏+数据面板+选品模式+辅助元素
- **v1.1.0-bugfix**: 修复审查问题
  - 修复API路径为`/api/market-signals/batch`
  - 集成ozon.ts/wb.ts V4提取器
  - 支持多域名(wildberries.by, ozon.by等)
  - 添加采集状态通知机制
- **v1.1.0-enhanced**: 采集增强功能(4-A3)
  - 已采集标记(详情页+搜索页)
  - 采集预览确认面板
  - 批量采集进度显示
  - Popup采集统计卡片
- **v1.1.0-enhanced-bugfix**: 审查修复
  - 修复main.ts未集成CollectedStore导致已采集标记功能失效
- **v1.1.0-enhanced-bugfix2**: 字段修复
  - 采集箱列表添加profitRate字段显示
  - 修复API与前端字段命名不一致问题(title→productTitle, platform→sourceType)
  - PlatformBadge组件支持sourceType
  - 添加ProfitRateBadge颜色预警组件
  - 详情页初始化时检查并传递已采集状态
  - 采集成功后更新本地已采集存储
- **v1.1.0-enhanced**: 利润计算器增强(5-A1)
  - 面板利润率展示带颜色预警(>20%绿/10-20%黄/<10%红)
  - 利润计算器增强(类目自动填充佣金率、建议售价反推)
  - 历史记录缓存到chrome.storage.local
  - 采集数据携带profitRate字段
- **v1.0.6**: 采集箱批量操作修复
  - 批量发布/删除操作实现
  - 已发布Tab自动刷新功能
- **v1.0.8**: 选品页面5个子Tab(4-C3)
  - 市场热词/热销标签/热销类目/热销店铺/热销品牌Tab
  - 各Tab特有筛选条件和结果列
- **v1.1.1**: 关键词Tab激活(6-A1)
  - 激活"关键词反查"和"关键词挖掘"Tab
  - 实现关键词反查面板（显示商品关联关键词）
  - 实现关键词挖掘面板（输入种子词搜索相关词）
  - 新增关键词API（/api/keywords/reverse, /api/keywords/mining）
  - 共用统一页面模板组件
- **v1.1.2**: 商品面板关键词展示(6-A1)
  - 商品数据面板新增"关键词"行
  - 从商品标题提取Top5关键词标签
  - 点击关键词标签跳转到关键词挖掘Tab
  - 关键词自动预填并搜索
  - 共用统一页面模板组件
- **v1.0.8**: 选品页面5个子Tab(4-C3)
  - 市场热词/热销标签/热销类目/热销店铺/热销品牌/产品库
  - 各Tab特有筛选条件和结果列
  - 共用统一页面模板组件
  - 销售趋势图表(Recharts)
  - 修复Math.max空数组问题

### 侧边栏改造 + 选品页面 (4-C1)
- **侧边栏精简**: 7个一级入口 + ERP保留模块
- **选品页面Tab**: 7个Tab切换（热销榜单/热词/标签/类目/店铺/品牌/产品库）
- **统一页面模板**: 筛选区 + 表格 + 批量操作 + 分页 + 推荐模式
- **蓝白风格**: 主色#1677FF，背景白，趋势指标色

### 热销榜单 + 详情页 (4-C2)
- **热销榜单Tab**: 29列数据表格，推荐模式/进阶筛选
- **详情页4个Tab**: 基本信息/销售趋势/关键词/引擎分析(灰)
- **销售趋势图表**: 近30天销量/价格/销售额折线图
- **29列字段**: rank, image, title, sku, brand, category, price, sales, revenue, profitRate, impressions, cardViews, cartRate, adShare, returnRate, reviewCount, rating, listedDate, weight, volume, sellerName, sellerType, deliveryType, qaCount, variants, engineScore, etc.

### 采集箱前端页面 (4-B1)
- **页面路由**: `/collection-box`
- **三个Tab**: 待认领 / 已认领 / 已发布
- **商品编辑弹窗**: 标题/描述/属性/图片/价格编辑
- **利润计算器**: 实时计算利润率，颜色预警
- **批量操作**: 批量认领/发布/删除
- **自动刷新**: 已发布Tab每60秒自动刷新状态
- **v1.0.6**: 审查修复 - 实现批量发布/删除功能，添加已发布Tab自动刷新

### 选品页面 (4-C1)
- **页面路由**: `/selection`
- **7个Tab**: 热销榜单 / 市场热词 / 热销标签 / 热销类目 / 热销店铺 / 热销品牌 / 产品库
- **统一页面模板**: 筛选区 + 表格 + 批量操作 + 分页 + 推荐模式
- **平台切换**: Ozon / Wildberries
- **推荐模式**: 销量飙升榜 / 潜力市场 / 未被满足 / 不压库存 / 引擎推荐(预留)
- **筛选条件**: 类目 / 售价 / 销量 / 评论数 / 评分 / 进阶筛选
- **批量操作**: 批量采集 / 加入产品库 / 导出
- **引擎预留位**: 6处（综合评分/评分排序/引擎推荐Tab/详情分析/筛选/卡片）
- **蓝白风格**: 主色#1677FF，背景白，趋势指标色

### 侧边栏改造 (4-C1)
- **精简版侧边栏**: 仪表盘 / 选品 / 关键词(锁) / 监控(锁) / 采集箱 / AI工具(锁) / 运营(锁)
- **ERP保留模块**: 订单管理 / 采购管理 / 物流管理 / 财务管理 / 系统设置
- **激活状态**: 蓝底白字 #1677FF
- **锁定模块**: 灰色 🔒 + hover显示"即将上线"

### 功能特性
1. **导航栏**: 蓝色顶部栏，4个Tab，品牌Logo，控制按钮
2. **数据面板**: 商品详情页显示29列数据，利润计算器，采集预览
3. **选品模式**: 搜索/类目页批量勾选和采集，已采集商品显示绿色✓标记
4. **辅助元素**: 回到顶部、语言切换、反馈按钮
5. **采集增强**: 预览确认、进度显示、统计卡片

### 构建命令
```bash
cd ozon-extension
pnpm build
```

### 安装
1. 打开Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `ozon-extension/dist` 目录

### 打包
```bash
tar -czvf ozon-extension-v1.1.0-enhanced.tar.gz dist/
```
