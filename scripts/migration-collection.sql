-- =====================================================
-- 采集箱(Collections)模块数据库迁移
-- 功能：采集箱CRUD、认领/发布、Ozon对接
-- 执行时间: 2024-06-13
-- =====================================================

-- 1. 采集箱主表
CREATE TABLE IF NOT EXISTS collection_items (
  id SERIAL PRIMARY KEY,
  signal_id INTEGER REFERENCES market_signals(id) ON DELETE CASCADE,
  shop_id VARCHAR(36) REFERENCES shops(id),
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,  -- pending/claimed/published/rejected
  -- 认领信息
  claimed_at TIMESTAMP WITH TIME ZONE,
  claimed_by VARCHAR(50),
  warehouse_id INTEGER,
  -- 发布信息
  published_at TIMESTAMP WITH TIME ZONE,
  ozon_task_id VARCHAR(100),
  ozon_product_id VARCHAR(100),
  publish_status VARCHAR(30) DEFAULT 'pending',  -- pending/pending_review/listed/rejected
  publish_error TEXT,
  -- 编辑数据（JSONB覆盖原始信号数据）
  edited_data JSONB DEFAULT '{}',
  -- 元数据
  notes TEXT,
  priority INTEGER DEFAULT 0,  -- 优先级：0普通, 1重要, 2紧急
  tags TEXT[],  -- 自定义标签
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 采集箱索引
CREATE INDEX IF NOT EXISTS idx_collection_status ON collection_items(status);
CREATE INDEX IF NOT EXISTS idx_collection_shop ON collection_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_collection_signal ON collection_items(signal_id);
CREATE INDEX IF NOT EXISTS idx_collection_publish_status ON collection_items(publish_status);
CREATE INDEX IF NOT EXISTS idx_collection_created ON collection_items(created_at DESC);

-- 2. 类目佣金率表（利润计算用）
CREATE TABLE IF NOT EXISTS ozon_category_commissions (
  id SERIAL PRIMARY KEY,
  ozon_category_id VARCHAR(50) NOT NULL,
  category_name VARCHAR(200) NOT NULL,
  commission_rate NUMERIC(5, 4) NOT NULL,  -- 佣金率，如 0.15 表示 15%
  min_commission NUMERIC(10, 2) DEFAULT 0,  -- 最低佣金(₽)
  effective_from DATE,  -- 生效日期
  effective_to DATE,  -- 失效日期
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 佣金率索引
CREATE INDEX IF NOT EXISTS idx_category_comm_ozon_id ON ozon_category_commissions(ozon_category_id);
CREATE INDEX IF NOT EXISTS idx_category_comm_active ON ozon_category_commissions(is_active);

-- 3. 物流费用估算表
CREATE TABLE IF NOT EXISTS logistics_estimates (
  id SERIAL PRIMARY KEY,
  weight_min NUMERIC(10, 2) NOT NULL,  -- 最小重量(g)
  weight_max NUMERIC(10, 2) NOT NULL,  -- 最大重量(g)
  logistics_type VARCHAR(20) NOT NULL,  -- FBS/FBO/FBP
  estimated_cost_cny NUMERIC(10, 2) NOT NULL,  -- 估算费用(¥)
  notes VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 物流费用索引
CREATE INDEX IF NOT EXISTS idx_logistics_weight ON logistics_estimates(weight_min, weight_max);

-- 4. 汇率表
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  currency_pair VARCHAR(10) NOT NULL,  -- RUB_CNY
  rate NUMERIC(10, 6) NOT NULL,
  source VARCHAR(50),  -- 数据来源
  fetched_at TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_current ON exchange_rates(currency_pair, is_current);

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入默认类目佣金率（常见类目）
INSERT INTO ozon_category_commissions (ozon_category_id, category_name, commission_rate, is_active) VALUES
  ('electronic_modules', '电子元器件', 0.08, TRUE),
  ('phones', '手机配件', 0.12, TRUE),
  ('computer_components', '电脑配件', 0.10, TRUE),
  ('household_goods', '家居用品', 0.15, TRUE),
  ('clothing', '服装', 0.18, TRUE),
  ('shoes', '鞋类', 0.18, TRUE),
  ('toys', '玩具', 0.15, TRUE),
  ('cosmetics', '化妆品', 0.20, TRUE),
  ('food', '食品', 0.15, TRUE),
  ('default', '其他类目', 0.15, TRUE)
ON CONFLICT DO NOTHING;

-- 插入默认物流费用估算
INSERT INTO logistics_estimates (weight_min, weight_max, logistics_type, estimated_cost_cny, notes) VALUES
  (0, 100, 'FBS', 5.00, '0-100g'),
  (100, 300, 'FBS', 8.00, '100-300g'),
  (300, 500, 'FBS', 12.00, '300-500g'),
  (500, 1000, 'FBS', 18.00, '500g-1kg'),
  (1000, 2000, 'FBS', 25.00, '1-2kg'),
  (2000, 5000, 'FBS', 35.00, '2-5kg'),
  (5000, 10000, 'FBS', 50.00, '5-10kg'),
  (10000, 30000, 'FBS', 80.00, '10-30kg')
ON CONFLICT DO NOTHING;

-- 插入默认汇率
INSERT INTO exchange_rates (currency_pair, rate, source, is_current) VALUES
  ('RUB_CNY', 0.080, 'default', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 回滚脚本
-- =====================================================
/*
DROP TABLE IF EXISTS collection_items;
DROP TABLE IF EXISTS ozon_category_commissions;
DROP TABLE IF EXISTS logistics_estimates;
DROP TABLE IF EXISTS exchange_rates;
*/
