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
│   │   ├── selection.ts    # 选品模式组件
│   │   ├── helpers.ts      # 辅助元素组件
│   │   ├── ozon.ts        # Ozon平台提取器
│   │   └── wb.ts          # WB平台提取器
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
- **v1.1.0**: 导航栏+数据面板+选品模式+辅助元素

### 功能特性
1. **导航栏**: 蓝色顶部栏，4个Tab，品牌Logo，控制按钮
2. **数据面板**: 商品详情页显示29列数据，利润计算器
3. **选品模式**: 搜索/类目页批量勾选和采集
4. **辅助元素**: 回到顶部、语言切换、反馈按钮

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
tar -czvf ozon-extension-v1.1.0.tar.gz dist/
```
