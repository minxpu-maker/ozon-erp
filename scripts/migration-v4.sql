-- =====================================================
-- Schema V4 迁移脚本
-- market_signals 表新增18个字段
-- 执行时间: 2024-06-13
-- =====================================================

-- 1. 商家与配送（6项）
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS seller_type VARCHAR(50);  -- 'local' | 'cross_border'
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS follower_count INTEGER;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS variant_count INTEGER;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50);  -- 'FBO' | 'FBS' | 'RFBS' | 'FBP'

-- 2. 商品规格（5项）
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 2);  -- g
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS dimension_length NUMERIC(10, 2);  -- mm
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS dimension_width NUMERIC(10, 2);  -- mm
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS dimension_height NUMERIC(10, 2);  -- mm
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS volume NUMERIC(10, 6);  -- L (长×宽×高/1000000)
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS listed_date DATE;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS stock INTEGER;

-- 3. 计算/估算（3项）
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS revenue NUMERIC(15, 2);  -- price × salesVolume
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS profit_rate NUMERIC(5, 2);  -- 利润率百分比
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(10, 2);  -- 采购成本(¥)

-- 4. API占位（5项）
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS return_rate NUMERIC(5, 2);  -- 退货率
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS impressions INTEGER;  -- 展示次数
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS card_views INTEGER;  -- 商品卡片浏览量
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS cart_rate NUMERIC(5, 4);  -- 加购率
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS ad_share NUMERIC(5, 4);  -- 广告占比

-- =====================================================
-- 添加索引（优化查询性能）
-- =====================================================

-- 卖家类型索引
CREATE INDEX IF NOT EXISTS idx_market_signals_seller_type ON market_signals(seller_type);

-- 配送类型索引
CREATE INDEX IF NOT EXISTS idx_market_signals_delivery_type ON market_signals(delivery_type);

-- 销量索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_market_signals_sales_volume ON market_signals(sales_volume DESC);

-- 营收索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_market_signals_revenue ON market_signals(revenue DESC);

-- 上架日期索引
CREATE INDEX IF NOT EXISTS idx_market_signals_listed_date ON market_signals(listed_date);

-- =====================================================
-- 添加注释
-- =====================================================

COMMENT ON COLUMN market_signals.seller_name IS '卖家名称';
COMMENT ON COLUMN market_signals.seller_type IS '卖家类型: local(本土)/cross_border(跨境)';
COMMENT ON COLUMN market_signals.follower_count IS '卖家粉丝数量';
COMMENT ON COLUMN market_signals.variant_count IS '商品变体数量';
COMMENT ON COLUMN market_signals.delivery_type IS '配送类型: FBO/FBS/RFBS/FBP';
COMMENT ON COLUMN market_signals.weight IS '商品重量(g)';
COMMENT ON COLUMN market_signals.dimension_length IS '商品长度(mm)';
COMMENT ON COLUMN market_signals.dimension_width IS '商品宽度(mm)';
COMMENT ON COLUMN market_signals.dimension_height IS '商品高度(mm)';
COMMENT ON COLUMN market_signals.volume IS '商品体积(L)';
COMMENT ON COLUMN market_signals.listed_date IS '商品上架日期';
COMMENT ON COLUMN market_signals.stock IS '库存数量';
COMMENT ON COLUMN market_signals.revenue IS '估算营收(price×salesVolume)';
COMMENT ON COLUMN market_signals.profit_rate IS '利润率(%)';
COMMENT ON COLUMN market_signals.purchase_cost IS '采购成本(¥)';
COMMENT ON COLUMN market_signals.return_rate IS '退货率(%)';
COMMENT ON COLUMN market_signals.impressions IS '展示次数';
COMMENT ON COLUMN market_signals.card_views IS '商品卡片浏览量';
COMMENT ON COLUMN market_signals.cart_rate IS '加购率';
COMMENT ON COLUMN market_signals.ad_share IS '广告占比';

-- =====================================================
-- 回滚脚本（如果需要回滚）
-- =====================================================
/*
-- 删除索引
DROP INDEX IF EXISTS idx_market_signals_seller_type;
DROP INDEX IF EXISTS idx_market_signals_delivery_type;
DROP INDEX IF EXISTS idx_market_signals_sales_volume;
DROP INDEX IF EXISTS idx_market_signals_revenue;
DROP INDEX IF EXISTS idx_market_signals_listed_date;

-- 删除列
ALTER TABLE market_signals DROP COLUMN IF EXISTS seller_name;
ALTER TABLE market_signals DROP COLUMN IF EXISTS seller_type;
ALTER TABLE market_signals DROP COLUMN IF EXISTS follower_count;
ALTER TABLE market_signals DROP COLUMN IF EXISTS variant_count;
ALTER TABLE market_signals DROP COLUMN IF EXISTS delivery_type;
ALTER TABLE market_signals DROP COLUMN IF EXISTS weight;
ALTER TABLE market_signals DROP COLUMN IF EXISTS dimension_length;
ALTER TABLE market_signals DROP COLUMN IF EXISTS dimension_width;
ALTER TABLE market_signals DROP COLUMN IF EXISTS dimension_height;
ALTER TABLE market_signals DROP COLUMN IF EXISTS volume;
ALTER TABLE market_signals DROP COLUMN IF EXISTS listed_date;
ALTER TABLE market_signals DROP COLUMN IF EXISTS stock;
ALTER TABLE market_signals DROP COLUMN IF EXISTS revenue;
ALTER TABLE market_signals DROP COLUMN IF EXISTS profit_rate;
ALTER TABLE market_signals DROP COLUMN IF EXISTS purchase_cost;
ALTER TABLE market_signals DROP COLUMN IF EXISTS return_rate;
ALTER TABLE market_signals DROP COLUMN IF EXISTS impressions;
ALTER TABLE market_signals DROP COLUMN IF EXISTS card_views;
ALTER TABLE market_signals DROP COLUMN IF EXISTS cart_rate;
ALTER TABLE market_signals DROP COLUMN IF EXISTS ad_share;
*/
