---
AIGC:
    Label: "1"
    ContentProducer: 001191110102MACQD9K64018705
    ProduceID: 2566723632919907_0/project_7648227611545600271-files/docs/ozon-selection-algorithm-v3.md
    ReservedCode1: ""
    ContentPropagator: 001191110102MACQD9K64028705
    PropagateID: 2566723632919907#1780896888309
    ReservedCode2: ""
---
# Ozon AI智能选品 — 选品模型算法设计（最终版）

> 项目：Ozon AI智能选品一键修图上架系统
> 项目ID：7648227611545600271
> 版本：V3.0（在V2基础上补充冷启动方案、降级策略及完善决策记录）
> 日期：2026-06-08
> 参与者：飞羽(主持)、CozeAgent、openclaw小龙虾、claude code、深度调研

---

## 一、设计原则

1. **淘汰线性加权** — 权重拍脑袋、维度互补偿、无法处理冲突，这三个硬伤不可接受
2. **硬约束前置** — EAC认证（按卖家类型）、价格范围（按店铺阶段）等硬约束必须先过滤
3. **品类独立建模** — Jungle Scout验证过，不同品类评分逻辑完全不同
4. **店铺阶段适配** — 跟卖和精铺是两种完全不同的选品逻辑，算法必须双模式
5. **LLM只做擅长的事** — 语义理解和文本推理，不碰数值评分
6. **一期可落地** — Next.js+PG+Drizzle+pgvector就能跑，不需要额外基础设施

---

## 二、五层递进算法架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    选品算法五层递进架构                             │
│                                                                  │
│  第零层：店铺阶段识别 + 卖家类型识别（决定硬约束规则集）           │
│    新店(≤3月)→跟卖模式/200~1500₽ | 老店(>3月)→精铺模式          │
│    中国卖家→EAC仅提示 | 俄罗斯本土卖家→EAC一票否决               │
│                                                                  │
│  第一层：硬约束过滤（Rule-based Filter）                          │
│    EAC不合规(俄本土)→淘汰 / 200~1500₽(新店)→硬约束              │
│    体积>0.5L→降权 / 单价<500₽(精铺)→降权                        │
│                                                                  │
│  第二层：组合赋权（AHP主观 + 熵权法客观）                         │
│    品类自适应权重，跟卖/精铺用不同AHP判断矩阵                     │
│                                                                  │
│  第三层：双通道评分                                               │
│    通道A：AHP-TOPSIS 多准则评分（结构化数据）                     │
│    通道B：LLM Embedding + 语义相似度/评分模型 语义评分（非结构化数据）│
│                                                                  │
│  第四层：Prophet时序预测（趋势阶段判定 + 销量预测）               │
│    内嵌俄罗斯假期日历，yearly_seasonality=15                      │
│                                                                  │
│  第五层：LLM推理层（信号解读 + 差异化建议 + 风险研判）            │
│    LLM只做解读不改分数，关键结论标注数据来源                      │
│                                                                  │
│  综合输出：复合评分 + 趋势方向 + AI解读 + 风险提示                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、第零层：店铺阶段 + 卖家类型识别

在硬约束过滤之前，先识别当前店铺的阶段和卖家类型，决定后续使用哪套硬约束规则集和AHP权重矩阵。

### 3.0.1 店铺阶段判定

| 阶段 | 判定条件 | 选品模式 | 核心目标 |
|------|---------|---------|---------|
| new（新店期） | 店龄 ≤ 3个月 | 跟卖 | 快速起量、积累店铺权重、验证市场 |
| growing（成长期） | 店龄 > 3个月 + 有高评价链接 | 跟卖→精铺过渡 | 已验证的品做精铺差异化 |
| mature（成熟期） | 店龄 > 3个月 + 多条高权重链接 | 精铺为主 | 建立护城河、利润最大化 |

**阶段自动识别逻辑**（V2新增D-028）：
- 从Ozon Seller API获取店铺创建时间 → 计算店龄
- 从Ozon Seller API获取在售商品的评价数/评分 → 判断是否有"高评价链接"（评价数>50且评分≥4.5）
- 系统默认新店→跟卖，但允许用户手动切换

### 3.0.2 卖家类型识别

| 卖家类型 | EAC认证处理 | 来源 |
|---------|------------|------|
| 中国跨境卖家 | ⚠️ 风险提示（不淘汰，但标注"EAC认证可能未来影响"） | 默认类型 |
| 俄罗斯本土卖家 | 🚫 一票否决（EAC不合规=直接淘汰） | 用户选择 |

**设计考量**：EAC认证目前针对俄罗斯本土卖家，中国卖家暂不影响。但政策可能变化，系统需预留"一键切换"能力——当EAC对中国卖家生效时，只需改配置即可从"提示"切换为"否决"。

---

## 三、第四层：Prophet时序预测

### 6.1 模型

```
y(t) = g(t) + s(t) + h(t) + ε(t)

g(t) = 趋势（增长/衰退/饱和）
s(t) = 季节性（yearly_seasonality=15，俄罗斯极端季节性）
h(t) = 节假日效应（内嵌俄罗斯假期日历）
ε(t) = 残差
```

### 6.2 俄罗斯假期日历（必须内置）

| 日期 | 假期 | 对选品的影响 |
|------|------|-------------|
| 1月1-8日 | 新年长假 | 全年GMV最高峰，礼品/装饰/食品爆发 |
| 2月23日 | 祖国保卫者日 | 男性礼品爆发 |
| 3月8日 | 国际妇女节 | 美妆/饰品/鲜花爆发 |
| 5月1-9日 | 春节+胜利日 | 户外/烧烤/旅行品爆发 |
| 6月12日 | 俄罗斯日 | 爱国主题商品 |
| 9月1日 | 知识日 | 文具/书包/电子品爆发 |
| 11月 | 黑五 | 全品类大促 |

### 6.3 输出

| 指标 | 含义 | 用途 |
|------|------|------|
| 预测7天销量 | 短期趋势 | 检测爆发信号 |
| 预测30天销量 | 中期趋势 | 季节窗口判断 |
| 趋势方向 | up/down/stable | 评分权重调整 |
| 趋势拐点 | 变化点检测 | 提前布局信号 |

---

## 四、第一层：硬约束过滤

在评分之前，先把不配进评分的淘汰掉。硬约束规则集根据第零层的店铺阶段和卖家类型动态决定。

### 4.1 一票否决项（直接淘汰，不进评分）

| 约束 | 判定逻辑 | 适用条件 | 依据 |
|------|---------|---------|------|
| EAC认证不合规 | 该品类要求EAC认证且无法提供 → 淘汰 | **仅俄罗斯本土卖家** | 2026新规：无证100%下架+罚款货值300% |
| EAC认证风险 | 该品类要求EAC认证 → ⚠️提示 | **中国卖家** | 暂不淘汰，标注风险 |
| 禁售品类 | Ozon禁售清单命中 → 淘汰 | 全部卖家 | Ozon平台规则 |
| 知识产权高危 | 知名品牌词命中且无授权 → 淘汰 | 全部卖家 | 品牌投诉→店铺降权 |

### 4.2 新店跟卖阶段硬约束（新增）

| 约束 | 判定逻辑 | 折扣因子 | 依据 |
|------|---------|---------|------|
| 价格<200₽ | 利润被物流完全吃掉 | 淘汰 | 新店低客单价无生存空间 |
| 价格>1500₽ | 资金占用大+新店信任度不够 | 淘汰 | 高客单品需店铺权重支撑 |
| 评价数<20 | 市场尚未验证 | 降权×0.5 | 跟卖必须找"已被验证"的品 |
| 在售卖家数>50 | 竞争过于拥挤 | 降权×0.6 | 跟卖要看还有没有空间 |

### 4.3 强降权项（评分后乘折扣因子）

| 约束 | 判定逻辑 | 折扣因子 | 适用阶段 | 依据 |
|------|---------|---------|---------|------|
| 体积>0.5升 | 物流成本占比飙升 | ×0.5 | 全阶段 | 俄罗斯物流极贵 |
| 单价<500₽(精铺) | 利润被物流吃掉 | ×0.6 | 精铺阶段 | 运费占比过高 |
| 单价>25000₽ | 资金占用大+退货风险 | ×0.8 | 全阶段 | 冻结资金成本 |
| 重量>2kg | 配送受限+成本高 | ×0.6 | 全阶段 | 偏远地区配送 |
| 卢布30日波动>15% | 汇率风险极高 | ×0.7 | 全阶段 | 利润可能归零 |

### 4.4 过滤效果

预计90%的候选品类/商品在第一层被淘汰或降权，大幅减少后续计算量。

---

## 五、第二层：组合赋权

### 5.1 为什么不用固定权重？

不同品类的维度重要性完全不同：
- 电子产品：利润权重应该最高（佣金高+竞争白热化）
- 服装鞋帽：需求权重应该最高（季节性强+趋势驱动）
- 家居日用：供给权重应该最高（供应链稳定性决定成败）

### 5.2 AHP层次分析法（主观权重）

通过两两比较构建判断矩阵，1-9标度：

```
         需求D  竞争C  利润P  供给S  风险R
需求D  [  1     3      2      4      5  ]
竞争C  [ 1/3    1     1/2     2      3  ]
利润P  [ 1/2    2      1      3      4  ]
供给S  [ 1/4   1/2    1/3     1      2  ]
风险R  [ 1/5   1/3    1/4    1/2     1  ]
```

特征向量法求权重 → W_主观 = [0.42, 0.16, 0.26, 0.10, 0.06]
一致性检验 CR = 0.03 < 0.1 ✅ 通过

**按品类分表存储**：每个品类有独立的AHP判断矩阵，权重不同。

### 5.3 熵权法（客观权重）

对每个特征的N个样本计算信息熵：

```
信息熵: E_j = -k × Σ(p_ij × ln(p_ij))    其中 k = 1/ln(N)
权重:   W_客观_j = (1 - E_j) / Σ(1 - E_j)
```

熵越小 → 该特征的区分度越高 → 权重越大。
**让数据自己说话**，哪个特征对选品结果区分度最大，就自动获得更高权重。

### 5.4 组合权重

```
W = α × W_主观 + (1 - α) × W_客观

α 初始值 = 0.5（主客观各半）
后续用贝叶斯优化自动调α（基于历史选品效果回溯）
```

---

## 六、第三层：双通道评分

### 6.1 通道A：AHP-TOPSIS多准则评分

**为什么TOPSIS比线性加权强？**
- 不假设维度间线性补偿（高利润不能补偿EAC不合规）
- 同时考虑"离最优多近"和"离最差多远"
- 自动处理反向指标（竞争度越低越好）

**算法步骤：**

```
Step 1: 构建决策矩阵 R（m个候选 × n个特征）
Step 2: 归一化 → r_ij = x_ij / √(Σ x_ij²)
Step 3: 加权归一化 → v_ij = w_j × r_ij
Step 4: 确定正理想解 A+ 和负理想解 A-
Step 5: 计算欧氏距离 D_i+ 和 D_i-
Step 6: 贴近度 C_i = D_i- / (D_i+ + D_i-)    0 ≤ C_i ≤ 1
```

C_i越接近1，该候选越优。

### 6.2 通道B：语义评分通道

**为什么需要这个通道？** TOPSIS只吃结构化数值，但选品最关键的信号往往在文本里：
- 竞品标题/描述里的差异化空白
- 买家评论里反复出现的痛点
- 品类之间的语义关联（保温杯→保温袋→暖手宝）

#### 6.2.1 语义评分一期降级方案（V2新增 P0）

由于一期无标注数据，LightGBM无法开箱即用，采用以下降级方案：

```
[产品标题+描述+评论关键词] → LLM Embedding API → 1536维向量
                                                        ↓
[品类中心向量]（该品类Top100商品的平均Embedding）       ↓
                                                        ↓
                                               计算余弦相似度
                                                        ↓
                                              简化版语义评分
```

**具体做法**：
1. 从知识库获取该品类的中心向量（或计算Top100商品的平均Embedding）
2. 产品Embedding与品类中心向量计算余弦相似度
3. 相似度越高，说明产品越"主流"，差异化空间越小
4. 语义评分 = 1 - 余弦相似度（转换为：差异化机会评分）

**降级期间语义评分含义变化**：
- 原设计："非结构化信号评分"（基于LightGBM训练）
- 一期实现："语义相似度评分"（基于余弦相似度）

**积累标注数据后的切换**：
- 目标：积累3个月历史选品结果作为标注数据
- 切换条件：至少100条"选品→上架→销售表现"闭环数据
- 切换后：重新训练LightGBM，替代余弦相似度方案

```
降级评分 = 1 - cosine_similarity(product_embedding, category_center)

其中：
- product_embedding: 产品标题+描述的Embedding向量
- category_center: 该品类Top100商品的平均Embedding
- 评分范围: [0, 1]，越高表示越偏离主流（差异化机会越大）
```

#### 6.2.2 完整方案（二期）

```
[产品标题+描述+评论关键词] → LLM Embedding API → 1536维向量（缓存到PG pgvector）
[结构化特征：价格/销量/评分/卖家数...] → 特征拼接 → [1536+N维]
                                                            ↓
                                                     LightGBM → 语义评分
```

**为什么不让LLM直接打分？** LLM对数字敏感度差，给两个SKU的利润率它分不清谁高谁低。但Embedding把文本语义压缩成向量，LightGBM处理数值精度——各取所长。

**推理成本**：LightGBM <1ms/条，Embedding离线预计算，几乎零延迟。

### 6.3 通道融合

```
综合评分 = 0.40 × TOPSIS贴近度 + 0.20 × 语义评分 + 0.25 × Prophet趋势分 + 0.15 × 机会指数
```

> ⚠️ **权重待验证（D-016）**：上述权重(0.40/0.20/0.25/0.15)为初始值，一期运行3个月后用历史选品效果回溯调优。详见"学习闭环"章节。

---

## 七、第四层：Prophet时序预测

### 7.1 模型

```
y(t) = g(t) + s(t) + h(t) + ε(t)

g(t) = 趋势（增长/衰退/饱和）
s(t) = 季节性（yearly_seasonality=15，俄罗斯极端季节性）
h(t) = 节假日效应（内嵌俄罗斯假期日历）
ε(t) = 残差
```

### 7.2 俄罗斯假期日历（必须内置）

| 日期 | 假期 | 对选品的影响 |
|------|------|-------------|
| 1月1-8日 | 新年长假 | 全年GMV最高峰，礼品/装饰/食品爆发 |
| 2月23日 | 祖国保卫者日 | 男性礼品爆发 |
| 3月8日 | 国际妇女节 | 美妆/饰品/鲜花爆发 |
| 5月1-9日 | 春节+胜利日 | 户外/烧烤/旅行品爆发 |
| 6月12日 | 俄罗斯日 | 爱国主题商品 |
| 9月1日 | 知识日 | 文具/书包/电子品爆发 |
| 11月 | 黑五 | 全品类大促 |

### 7.3 Prophet冷启动方案（V2新增 P0）

新系统上线初期无历史销量数据，Prophet无法训练。一期采用以下降级方案：

#### 冷启动替代策略

1. **平台级类目趋势替代SKU级预测**
   - 从Ozon知识库/API获取类目整体销量趋势
   - 用类目趋势替代单个SKU的Prophet预测
   - 趋势分来源：类目30天销量环比/同比增速

2. **数据积累阈值**
   - 新店至少积累**2周**销量数据后才启用SKU级Prophet预测
   - 冷启动期间：用类目趋势预测替代

3. **冷启动期间综合评分公式调整**
   - Prophet权重从**0.25降为0.10**（冷启动数据不可靠，降低权重）
   - TOPSIS权重从**0.40升为0.55**（增加结构化评分权重）
   - 冷启动公式：
   ```
   综合评分 = 0.55 × TOPSIS贴近度 + 0.20 × 语义评分 + 0.10 × 类目趋势分 + 0.15 × 机会指数
   ```

4. **自动切换机制**
   - 检测条件：店铺有≥14天销量数据
   - 自动切换：Prophet权重恢复0.25，TOPSIS权重恢复0.40

#### 冷启动期数据要求

| 数据类型 | 冷启动来源 | 积累到可用时间 |
|---------|-----------|---------------|
| SKU级销量时序 | Ozon Seller API | 14天后启用Prophet |
| 类目级趋势 | Ozon Analytics API/知识库 | 开箱即用 |
| 产品Embedding | LLM Embedding API | 采集产品时实时生成 |
| 语义评分 | 余弦相似度计算 | 开箱即用 |

### 7.4 输出

| 指标 | 含义 | 用途 |
|------|------|------|
| 预测7天销量 | 短期趋势 | 检测爆发信号 |
| 预测30天销量 | 中期趋势 | 季节窗口判断 |
| 趋势方向 | up/down/stable | 评分权重调整 |
| 趋势拐点 | 变化点检测 | 提前布局信号 |

---

## 八、第五层：LLM推理层

### 8.1 三个角色

| 角色 | 输入 | 输出 | 约束 |
|------|------|------|------|
| 信号解读器 | 数据异常（如搜索涨40%但卖家只涨5%） | "该品类可能正处于蓝海窗口期，建议3天内完成选品决策" | 必须标注数据来源 |
| 竞品差异化分析 | Top5竞品标题/描述/评价关键词 | "竞品普遍缺少XX功能描述，'尺寸偏小'评价频率最高→建议主打大码版" | 不改分数 |
| 风险研判 | 品类属性中涉及认证/品牌/法规的信息 | "该品类需EAC认证概率85%，建议提前准备证书" | 带置信度标注 |

### 8.2 防幻觉机制

1. **LLM只产出文本特征和解读，不产出数值评分** — 评分由TOPSIS和LightGBM决定
2. **结构化Prompt + JSON Schema输出** — 限制自由发挥空间
3. **交叉验证** — LLM判断的趋势用数据验证（搜索量真的涨了吗？）
4. **置信度标注** — 每个判断带置信度，低置信度的降权或标记人工审核

---

## 九、评估维度体系（18+原子特征）

### 9.1 市场需求度 D

| 原子特征 | 计算方式 | 数据源 |
|---------|---------|--------|
| 搜索量增速(7d/30d/90d) | 环比增长率 | Ozon前台（插件爬取） |
| 类目GMV增速 | 同比/环比 | Ozon Analytics API |
| 速卖通RU区订单密度 | RU订单占全球比 | 速卖通 |
| 季节性指数 | STL分解seasonal强度 | 历史数据 |
| 流失收入 | 缺货/定价不当导致的错失收入 | MPStats方法论 |

### 9.2 竞争激烈度 C（反向分，越小分越高）

| 原子特征 | 计算方式 | 数据源 |
|---------|---------|--------|
| HHI指数(卖家集中度) | 头部10%卖家销量占比 | Ozon前台 |
| 同SKU在售数量 | 精确计数 | Ozon前台 |
| 价格离散系数 | CV = σ/μ | Ozon前台 |
| 新卖家涌入速率 | 近30天新增卖家/总卖家 | Ozon前台 |
| 垄断指数 | Top10订单量占Top100比例 | FindNiche方法论 |

### 9.3 利润空间 P

| 原子特征 | 计算方式 | 数据源 |
|---------|---------|--------|
| 毛利率 | (Ozon售价-1688成本-物流-佣金)/Ozon售价 | 1688+Ozon+物流 |
| ROI | (售价-全成本)/全成本 | 1688+Ozon |
| 佣金率 | 不同品类8%-25% | Ozon Seller API |
| 汇率风险系数 | RUB/CNY 30日波动率×风险溢价 | 央行公开数据 |
| 定价弹性 | 同类商品价格区间宽度 | Ozon前台 |

### 9.4 供给可行性 S

| 原子特征 | 计算方式 | 数据源 |
|---------|---------|--------|
| 1688供应商数 | 搜索结果数 | 1688 |
| MOQ(最低起订量) | 取中位数 | 1688 |
| 交货周期 | 供应商标注天数中位数 | 1688 |
| 海关出口趋势 | 同比变化 | 海关数据 |
| 中俄物流时效稳定性 | σ(时效) | 物流数据 |

### 9.5 合规风险 R（反向分，越低分越高）

| 原子特征 | 计算方式 | 数据源 |
|---------|---------|--------|
| EAC认证需求 | 该品类需认证属性数 | Ozon类目属性API |
| 知识产权风险指数 | 品牌词命中率 | 1688+Ozon |
| 退货率 | 类目平均退货率 | Ozon Analytics |
| 卢布汇率波动率 | 30日RUB/CNY波动σ | 公开数据 |

---

## 十、四源交叉验证算法

### 10.1 信号融合

```
需求端得分 D_need = f(Ozon前台数据, 速卖通RU区数据)
供给端得分 S_supply = f(1688数据, 海关出口数据)
```

### 10.2 交叉修正

| 需求端 | 供给端 | 结论 | 修正因子 |
|--------|--------|------|---------|
| 高需求 | 供给充足 | ✅ 黄金机会 | ×1.0 |
| 高需求 | 供给不足 | ⚠️ 有需求但缺货 | ×0.7 |
| 低需求 | 供给充足 | ⚠️ 货好找但卖不动 | ×0.5 |
| 低需求 | 供给不足 | ❌ 双低 | ×0.3 |

### 10.3 数据缺失处理

| 缺失情况 | 处理 |
|---------|------|
| Ozon前台缺失 | 用速卖通数据估算（俄罗斯需求镜像） |
| Ozon Seller API缺失 | 不影响选品评分，影响后续上架字段 |
| 速卖通缺失 | 仅靠Ozon+海关判断，标注"需求端验证不足" |
| 海关/1688缺失 | 用速卖通供给数据替代，标注"供给端验证不足" |
| 仅1个数据源 | 评分打7折 + 标注"数据验证不足" |

---

## 十一、店铺阶段选品模式 — 跟卖 vs 精铺

这是Ozon起店的核心业务逻辑，直接影响选品算法的行为。

### 11.1 跟卖模式（新店前3个月）

**核心逻辑**：找"已被验证且还有空间"的品，快速出单积累店铺权重。

```
筛选条件（硬约束叠加）：
  ① 价格 200~1500₽（新店硬约束）
  ② 评价数 ≥ 20（市场已验证）
  ③ 在售卖家数 < 50（还有跟卖空间）
  ④ 近30天销量增速 > 0（需求还在）

排序逻辑（权重偏向）：
  D(需求)权重最高 → 看的是"这个品卖得动"
  C(竞争)权重其次 → 看的是"还有没有坑位"
  P(利润)权重第三 → 跟卖阶段利润要求可适当放低
  S(供给)权重第四 → 跟卖的品供给一般不是问题
  R(风险)权重最低 → 合规风险通过硬约束已过滤

AHP判断矩阵（跟卖模式）：
         需求D  竞争C  利润P  供给S  风险R
需求D  [  1     3      5      7      9  ]  → 跟卖最看重需求验证
竞争C  [ 1/3    1      3      5      7  ]
利润P  [ 1/5   1/3     1      3      5  ]
供给S  [ 1/7   1/5    1/3     1      3  ]
风险R  [ 1/9   1/7    1/5    1/3     1  ]
```

**跟卖信号识别**：
- 爆款早期：搜索量涨>30%，卖家数涨<10%（蓝海窗口）
- 稳定爆款：日销>10单，评价数>100，卖家数<30（还有空间）
- 衰退期：搜索量连降7天，退货率上升（退出信号）

### 11.2 精铺模式（3个月后）

**核心逻辑**：将跟卖验证过的好品做差异化，或主动挖掘差异化蓝海品。

```
筛选条件：
  ① 价格范围可放宽（不限于200~1500₽，但需单独评估资金占用）
  ② 差异化空间评分 ≥ 60分（必须有差异化切入点）
  ③ 利润率 ≥ 25%（精铺利润要求更高）
  ④ 供给稳定性评分 ≥ 70分（精铺要做长期生意）

排序逻辑（权重偏向）：
  P(利润)权重最高 → 精铺要赚钱
  C(竞争)权重其次 → 差异化空间=竞争维度的逆向
  D(需求)权重第三 → 需求已由跟卖阶段验证
  S(供给)权重第四 → 供给稳定性很重要
  R(风险)权重提升 → 精铺做长期，合规风险更需关注

AHP判断矩阵（精铺模式）：
         需求D  竞争C  利润P  供给S  风险R
需求D  [  1    1/2    1/3     2     1/2 ]
竞争C  [  2     1     1/2     3      2  ]  → 差异化空间是核心
利润P  [  3     2      1      5      3  ]  → 精铺利润最重要
供给S  [ 1/2   1/3    1/5     1     1/2 ]
风险R  [  2    1/2    1/3     2      1  ]  → 长期经营风险权重提升
```

**精铺差异化信号识别**（新增语义维度）：
- 差评关键词聚合：竞品Top差评 → 你的切入点
- 标题/描述语义空白：竞品未覆盖的卖点 → 你的差异化
- 主图风格差异：竞品同质化严重 → 你的视觉突破
- 功能/规格空白：竞品缺少的规格选项 → 你的选品方向

### 11.3 跟卖→精铺转化触发（V2新增 D-027）

```
自动检测条件（任一满足即提醒用户）：
  ① 店龄 > 3个月
  ② 某商品链接评价数 > 50 且 评分 ≥ 4.5
  ③ 某商品近30天销量 > 同品类Top20%

触发动作：
  → 系统标记该商品为"精铺候选"
  → 重新用精铺AHP矩阵评分
  → 生成差异化建议报告（差评分析+标题优化+主图方向）
  → 用户确认后进入精铺流程（修图→详情优化→重新上架）
```

#### 转化状态流转机制（D-027）

当跟卖品决定转精铺时，执行以下状态流转：

```
┌─────────────────────────────────────────────────────────────────┐
│                     跟卖→精铺转化流程                              │
│                                                                  │
│  原opportunity（跟卖模式）                                       │
│       │                                                          │
│       │ 用户点击"转为精铺"                                        │
│       ▼                                                          │
│  创建新opportunity                                               │
│       │                                                          │
│       ├── mode = "refine"（精铺模式）                             │
│       ├── 继承原opportunity的:                                   │
│       │    targetCategoryId（目标类目）                           │
│       │    targetProductId（原跟卖产品）                          │
│       │    （建立关联关系：refineFromOpportunityId）               │
│       │                                                          │
│       └── 用精铺AHP矩阵重新评分                                   │
│                                                                  │
│  原opportunity                                                   │
│       │                                                          │
│       └── 保留不变，状态变为 "converted"（已转化）                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键规则**：
1. 新opportunity自动继承targetCategoryId和targetProductId
2. 用精铺AHP矩阵重新评分（不是跟卖矩阵）
3. 原opportunity保留历史记录，不删除
4. 两个opportunity通过refineFromOpportunityId字段关联

---

## 十二、店铺阶段自动检测逻辑（V2新增 D-028）

### 12.1 阶段判定规则

| 阶段转换 | 判定条件 | 触发动作 |
|---------|---------|---------|
| **new → growing** | 店龄>3月 **AND** 好评率>95% **AND** 月销>50单 | 进入成长阶段 |
| **growing → mature** | ≥3条高权重链接（评价>50/评分≥4.5） **AND** 月销>200单 | 进入成熟阶段 |

### 12.2 阶段切换流程

```
┌─────────────────────────────────────────────────────────────────┐
│                   店铺阶段自动检测流程                             │
│                                                                  │
│  每日定时检测店铺数据                                             │
│       │                                                          │
│       ├── 获取店龄（shopCreatedAt）                              │
│       ├── 获取好评率（评分≥4.5的评价占比）                        │
│       ├── 获取月销（近30天总订单数）                              │
│       └── 获取高权重链接数（评价>50且评分≥4.5）                   │
│       │                                                          │
│       ▼                                                          │
│  对比当前阶段                                                     │
│       │                                                          │
│       ├── 若满足更高阶段条件:                                     │
│       │    ① 推送通知给用户（"您的店铺已达到成长期/成熟期条件"）    │
│       │    ② 展示新阶段选品策略预览                               │
│       │    ③ 用户确认后切换selectionMode                         │
│       │    ④ 用新AHP矩阵重算所有待评估opportunity评分              │
│       │                                                          │
│       └── 若不满足条件: 不做任何变动                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.3 数据来源

| 指标 | 数据源 | API端点 |
|------|--------|---------|
| 店龄 | shopProfiles.shopCreatedAt | 初始化时录入 |
| 好评率 | Ozon Seller API - 评价统计 | /v1/product/comprices信息 |
| 月销 | Ozon Analytics API | /v1/analytics/data |
| 高权重链接数 | Ozon Seller API - 在售商品评价 | /v2/product/list |

---

## 十三、SKU/变体粒度处理（V2新增 D-026）

### 13.1 双层商品结构

```
┌─────────────────────────────────────────────────────────────────┐
│                     商品双层结构                                  │
│                                                                  │
│  SPU（商品卡） — Product                                         │
│       │                                                          │
│       ├── 通用标题（可被变体覆盖）                                │
│       ├── 通用描述                                               │
│       ├── 主图/视频                                              │
│       ├── 类目属性（通用）                                       │
│       └── 基础信息（品牌、材质等）                                 │
│                                                                  │
│  SKU（变体）— Variant                                            │
│       │                                                          │
│       ├── 变体属性（颜色/尺寸/容量等）                            │
│       ├── 独立定价（可选）                                       │
│       ├── 独立库存                                              │
│       ├── 独立图片（变体图）                                     │
│       └── 独立条码（可选）                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 选品算法粒度处理

| 场景 | 粒度选择 | 说明 |
|------|---------|------|
| 品类趋势分析 | SPU级 | 品类整体趋势与具体变体无关 |
| 竞品分析 | SPU级 | 对标同款产品（颜色/尺寸是内部差异） |
| 定价分析 | SKU级 | 不同变体有不同定价和利润率 |
| 差异化机会 | SKU级 | 特定变体规格可能存在空白 |
| 库存同步 | SKU级 | 每种变体独立库存 |
| 上架操作 | SKU级 | 选择具体变体上架 |

### 13.3 数据模型扩展

```typescript
// SPU商品卡表
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  spuId: varchar('spu_id', { length: 50 }),      // Ozon商品SPU ID
  categoryId: integer('category_id'),
  title: varchar('title', { length: 500 }),
  description: text('description'),
  brand: varchar('brand', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// SKU变体表（V2新增 D-026）
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  skuId: varchar('sku_id', { length: 50 }),      // Ozon商品SKU ID
  variantAttributes: jsonb('variant_attributes'), // {颜色: "红色", 尺寸: "XL"}
  price: decimal('price', { precision: 10, scale: 2 }),
  stock: integer('stock'),
  images: jsonb('images'),                        // 变体专用图片
  barcode: varchar('barcode', { length: 50 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// opportunity关联粒度扩展
export const opportunities = pgTable('opportunities', {
  // ... 原有字段
  targetSpuId: varchar('target_spu_id'),         // 目标SPU（精铺原品）
  targetSkuId: varchar('target_sku_id'),          // 目标SKU（具体变体）
  refineFromOpportunityId: integer('refine_from_opportunity_id'), // 精铺转化来源
  mode: varchar('mode', { length: 20 }).default('follow'), // follow/refine
});
```

---

## 十四、Ozon API频率限制处理（V2新增 D-029）

### 14.1 API限制规格

| 限制维度 | 规格 |
|---------|------|
| 调用频率 | **3600次/小时/店铺** |
| 并发限制 | 单店铺不限制并发，但总量受小时配额限制 |
| 超限处理 | 返回429错误，需要等待下一个小时窗口 |

### 14.2 优先级队列设计

```
┌─────────────────────────────────────────────────────────────────┐
│                  API调用优先级队列                                │
│                                                                  │
│  优先级排序（从高到低）：                                         │
│       │                                                          │
│       ├── P0: 上架操作（用户直接操作，不可延迟）                  │
│       ├── P1: 评分计算（选品核心，需要及时反馈）                  │
│       ├── P2: 库存同步（定期同步，可适当延迟）                    │
│       └── P3: 数据采集（批量抓取，可后台运行）                    │
│                                                                  │
│  配额分配（3600次/小时）：                                        │
│       ├── P0 上架:   预留 600次/小时（17%）                      │
│       ├── P1 评分:   1800次/小时（50%）                          │
│       ├── P2 同步:   720次/小时（20%）                           │
│       └── P3 采集:   480次/小时（13%）                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 14.3 令牌桶限流实现

```typescript
class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  // 按优先级分配令牌桶
  constructor(shopId: string) {
    // P0: 10次/分钟 = 600次/小时
    this.buckets.set('p0', { capacity: 10, tokens: 10, refillRate: 10 });
    // P1: 30次/分钟 = 1800次/小时
    this.buckets.set('p1', { capacity: 30, tokens: 30, refillRate: 30 });
    // P2: 12次/分钟 = 720次/小时
    this.buckets.set('p2', { capacity: 12, tokens: 12, refillRate: 12 });
    // P3: 8次/分钟 = 480次/小时
    this.buckets.set('p3', { capacity: 8, tokens: 8, refillRate: 8 });
  }
  
  // 获取令牌（阻塞等待）
  async acquire(priority: 'p0' | 'p1' | 'p2' | 'p3'): Promise<void> {
    const bucket = this.buckets.get(priority);
    while (bucket.tokens < 1) {
      await this.waitForRefill(bucket);
    }
    bucket.tokens--;
  }
}
```

### 14.4 降级策略

| 场景 | 处理策略 |
|------|---------|
| P0配额耗尽 | 立即返回错误，提示用户手动重试 |
| P1配额耗尽 | 延迟到下一分钟，评分返回"计算中"状态 |
| P2/P3配额耗尽 | 自动排队到下一小时，不阻塞用户 |
| 全量超限 | 启动备用数据源（缓存数据） |

---

## 十五、学习闭环机制（V2新增 P1）

### 15.1 回溯触发条件

| 条件 | 触发动作 |
|------|---------|
| 积累**100条**选品数据后 | 触发首次回溯 |
| 之后每周自动回溯 | 持续优化 |
| 评分偏离实际结果≤20% | 达标，无需调整 |
| 评分偏离实际结果>20% | 自动触发权重微调 |

### 15.2 权重微调规则

```
评分准确度 = |预测评分 - 实际销售表现| / 实际销售表现

偏离度判断：
  - ≤20%: 达标，当前权重继续使用
  - 21%~50%: 轻度偏离，仅记录，提示人工关注
  - >50%: 重度偏离，自动计算建议调整方向

权重微调流程：
  1. 系统计算各维度权重建议值
  2. 生成调优报告（对比调整前后预测准确度）
  3. 推送通知给用户
  4. 用户确认后才生效（不自动覆盖）
```

### 15.3 冷启动期间权重自动调整规则

| 阶段 | 权重规则 |
|------|---------|
| **冷启动期**（<2周数据） | Prophet权重=0.10，TOPSIS权重=0.55 |
| **积累期**（2周~3月） | Prophet权重=0.15，TOPSIS权重=0.50 |
| **验证期**（3月后） | Prophet权重=0.25，TOPSIS权重=0.40（标准公式） |

### 15.4 学习闭环数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                    学习闭环数据流                                  │
│                                                                  │
│  选品决策 → 上架 → 销售表现                                       │
│       │                   │                                       │
│       │                   ▼                                       │
│       │            收集销售数据                                    │
│       │                   │                                       │
│       │                   ▼                                       │
│       │            回溯评分准确度                                  │
│       │                   │                                       │
│       │          ┌────────┴────────┐                              │
│       │          ▼                 ▼                              │
│       │      达标(≤20%)        不达标(>20%)                       │
│       │          │                 │                               │
│       │          │          计算权重建议                           │
│       │          │                 │                               │
│       │          │          推送人工确认                           │
│       │          │                 │                               │
│       │          ▼          用户确认生效                           │
│       │         无需操作 ◄──────┘                                  │
│       │                                                          │
│       └─────── 反馈到下次选品决策                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十六、交互模式 — 系统推荐 vs AI深挖

两种交互方式与跟卖/精铺模式正交组合，形成2×2矩阵：

|  | 系统推荐（广撒网） | AI深挖（定向挖） |
|---|---|---|
| **跟卖模式** | 系统扫描全平台已验证爆款推荐 | 用户说"我想跟卖XX品类"定向深挖 |
| **精铺模式** | 系统推荐有差异化空间的品类 | 用户说"我想在XX品类做差异化"定向分析 |

---

## 十七、评分等级与输出

| 分数区间 | 等级 | 含义 | 系统动作 |
|---------|------|------|---------|
| 80-100 | A 极力推荐 | 需求旺+竞争小+利润高+货源稳+趋势向上 | 推荐模式优先推送 |
| 60-79 | B 值得关注 | 有机会但某维度偏弱 | 推送+标注短板+建议深挖验证 |
| 40-59 | C 谨慎考虑 | 风险较大或竞争激烈 | 仅深挖模式展示 |
| 0-39 | D 不建议 | 红海或高风险 | 不主动推荐，深挖时给否决理由 |

---

## 十八、策略权重预设

### 18.1 通用策略

| 策略 | D | C | P | S | R | 适用 |
|------|---|---|---|---|---|------|
| 均衡（默认） | 30% | 25% | 25% | 15% | 5% | 通用 |
| 利润优先 | 15% | 15% | 45% | 15% | 10% | 老手敢拼 |
| 低风险优先 | 20% | 15% | 15% | 20% | 30% | 新手求稳 |
| 蓝海优先 | 15% | 40% | 20% | 15% | 10% | 找冷门 |

### 18.2 跟卖阶段策略

| 策略 | D | C | P | S | R | 适用 |
|------|---|---|---|---|---|------|
| 跟卖默认 | 40% | 25% | 20% | 10% | 5% | 新店跟卖主力策略 |
| 跟卖+蓝海 | 30% | 35% | 15% | 15% | 5% | 找竞争小的跟卖目标 |
| 跟卖+稳健 | 35% | 20% | 15% | 20% | 10% | 求稳优先，避免踩坑 |

### 18.3 精铺阶段策略

| 策略 | D | C | P | S | R | 适用 |
|------|---|---|---|---|---|------|
| 精铺默认 | 20% | 25% | 30% | 15% | 10% | 差异化+利润并重 |
| 精铺+高利润 | 10% | 20% | 45% | 10% | 15% | 赚钱为主 |
| 精铺+品牌 | 15% | 30% | 20% | 15% | 20% | 长期品牌化经营 |

> 注意：策略权重是AHP判断矩阵的初始输入，最终权重由AHP计算得出（保证一致性），不是直接用。

---

## 十九、排序与推荐策略

```
推荐排序 = 综合评分 × 策略权重 × 新鲜度衰减 × 硬约束折扣

新鲜度衰减 = 0.95^(days_since_discovery)
硬约束折扣 = 体积/重量/汇率等降权因子
```

### 去重与过滤

- 类目去重：同一类目只保留最高分
- 商品去重：图片哈希+标题相似度
- 黑名单：用户标记"不做"的不再推荐
- 已上架：已在售的不再作为新机会

---

## 二十、Ozon API数据→算法维度映射

| 算法维度 | 原子特征 | Ozon API端点 | 缺口说明 |
|---------|---------|-------------|---------|
| 需求D | 搜索量增速 | ⚠️ API不提供，需插件爬取 | **最大数据缺口** |
| 需求D | 类目GMV | `/v1/analytics/data` | 有 |
| 竞争C | 在售卖家数 | `/v2/product/list` | 采样估算 |
| 竞争C | 价格分布 | `/v4/product/info/prices` | 有 |
| 利润P | 佣金率 | `/v3/category/attribute` | 不同品类8%-25% |
| 风险R | EAC认证需求 | `/v3/category/attribute` | 检查сертификат属性 |
| 风险R | 退货率 | `/v3/returns/company/fbo` | 聚合品类 |
| 全局 | 类目树 | `/v2/category/tree` | 选品扫描基础 |

---

## 二十一、PG数据模型（Drizzle Schema核心）

```typescript
// 评分结果表
export const productScores = pgTable('product_scores', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  
  // 店铺阶段上下文
  shopStage: varchar('shop_stage', { length: 20 }),   // new/growing/mature → 跟卖/过渡/精铺
  sellerType: varchar('seller_type', { length: 20 }), // cn_crossborder/ru_local → 决定EAC处理方式
  selectionMode: varchar('selection_mode', { length: 20 }), // follow/refine → 跟卖/精铺
  
  // 通道A：AHP-TOPSIS评分
  topsisScore: decimal('topsis_score', { precision: 5, scale: 4 }),
  demandScore: decimal('demand_score', { precision: 5, scale: 4 }),
  competitionScore: decimal('competition_score', { precision: 5, scale: 4 }),
  profitScore: decimal('profit_score', { precision: 5, scale: 4 }),
  supplyScore: decimal('supply_score', { precision: 5, scale: 4 }),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }),
  
  // 通道B：语义评分
  semanticScore: decimal('semantic_score', { precision: 5, scale: 4 }),
  
  // Prophet趋势
  predictedSales7d: integer('predicted_sales_7d'),
  predictedSales30d: integer('predicted_sales_30d'),
  trendDirection: varchar('trend_direction', { length: 10 }), // up/down/stable
  
  // 机会指数
  opportunityIndex: decimal('opportunity_index', { precision: 5, scale: 4 }),
  
  // 综合评分
  compositeScore: decimal('composite_score', { precision: 5, scale: 4 }),
  grade: varchar('grade', { length: 1 }), // A/B/C/D
  
  // 硬约束
  hardConstraintDiscount: decimal('hard_constraint_discount', { precision: 3, scale: 2 }),
  crossVerifyDiscount: decimal('cross_verify_discount', { precision: 3, scale: 2 }),
  
  // 跟卖特有字段
  followSignal: varchar('follow_signal', { length: 20 }), // early_burst/stable_hot/declining
  sellerCountOnShelf: integer('seller_count_on_shelf'), // 在售卖家数（跟卖关键指标）
  
  // 精铺特有字段
  differentiationScore: decimal('differentiation_score', { precision: 5, scale: 4 }), // 差异化空间评分
  negativeReviewKeywords: jsonb('negative_review_keywords'), // 差评关键词聚合（精铺切入点）
  
  // EAC风险标记
  eacRiskLevel: varchar('eac_risk_level', { length: 10 }), // none/warning/veto
  
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

// AHP权重配置表（按品类×阶段独立）
export const ahpWeights = pgTable('ahp_weights', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 200 }),
  selectionMode: varchar('selection_mode', { length: 20 }), // follow/refine → 跟卖/精铺用不同矩阵
  weightMatrix: jsonb('weight_matrix').notNull(),    // AHP判断矩阵
  entropyWeights: jsonb('entropy_weights'),           // 熵权法客观权重
  combinedWeights: jsonb('combined_weights'),         // 组合权重
  alpha: decimal('alpha', { precision: 3, scale: 2 }).default('0.50'),
  consistencyRatio: decimal('consistency_ratio', { precision: 5, scale: 4 }),
  strategy: varchar('strategy', { length: 20 }),      // balanced/profit/risk/blueocean/follow_default/follow_blueocean/refine_default...
  isActive: boolean('is_active').default(true),
});

// 产品Embedding表（pgvector）
export const productEmbeddings = pgTable('product_embeddings', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  embedding: vector('embedding', { dimensions: 1536 }),
  model: varchar('model', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Prophet预测缓存表
export const prophetForecasts = pgTable('prophet_forecasts', {
  id: serial('id').primaryKey(),
  categoryOrProduct: varchar('category_or_product', { length: 200 }),
  targetType: varchar('target_type', { length: 10 }), // category/product
  forecastDate: date('forecast_date'),
  predictedValue: decimal('predicted_value', { precision: 10, scale: 2 }),
  trendDirection: varchar('trend_direction', { length: 10 }),
  changepoints: jsonb('changepoints'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 店铺信息表（新增）
export const shopProfiles = pgTable('shop_profiles', {
  id: serial('id').primaryKey(),
  ozonShopId: varchar('ozon_shop_id', { length: 50 }),
  shopName: varchar('shop_name', { length: 200 }),
  sellerType: varchar('seller_type', { length: 20 }).default('cn_crossborder'), // cn_crossborder/ru_local
  shopCreatedAt: timestamp('shop_created_at'),        // 店铺创建时间
  currentStage: varchar('current_stage', { length: 20 }), // new/growing/mature
  selectionMode: varchar('selection_mode', { length: 20 }), // follow/refine
  priceRangeMin: integer('price_range_min').default(200),   // 选品价格下限(₽)
  priceRangeMax: integer('price_range_max').default(1500),  // 选品价格上限(₽)
  eacPolicy: varchar('eac_policy', { length: 10 }).default('warning'), // warning/veto
  highReviewLinkCount: integer('high_review_link_count').default(0), // 高评价链接数
  lastStageCheckAt: timestamp('last_stage_check_at'),
});

// EAC认证配置表（一键切换能力）
export const eacConfig = pgTable('eac_config', {
  id: serial('id').primaryKey(),
  sellerType: varchar('seller_type', { length: 20 }).primaryKey(),
  policy: varchar('policy', { length: 10 }).notNull(), // warning/veto
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 50 }),
});

// SKU/变体表（V2新增 D-026）
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  skuId: varchar('sku_id', { length: 50 }),           // Ozon商品SKU ID
  variantAttributes: jsonb('variant_attributes'),      // {颜色: "红色", 尺寸: "XL"}
  price: decimal('price', { precision: 10, scale: 2 }),
  stock: integer('stock'),
  images: jsonb('images'),                            // 变体专用图片
  barcode: varchar('barcode', { length: 50 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Opportunity表扩展（V2新增 D-027）
export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  // ... 原有字段
  targetSpuId: varchar('target_spu_id'),                // 目标SPU（精铺原品）
  targetSkuId: varchar('target_sku_id'),                // 目标SKU（具体变体）
  refineFromOpportunityId: integer('refine_from_opportunity_id'), // 精铺转化来源
  mode: varchar('mode', { length: 20 }).default('follow'), // follow/refine
  status: varchar('status', { length: 20 }).default('active'), // active/converted/archived
  // ...
});

// API限流配置表（V2新增 D-029）
export const apiRateLimitConfig = pgTable('api_rate_limit_config', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 50 }),
  priority: varchar('priority', { length: 5 }),      // p0/p1/p2/p3
  hourlyQuota: integer('hourly_quota'),                 // 每小时配额
  currentUsage: integer('current_usage').default(0),   // 当前已使用
  resetAt: timestamp('reset_at'),                       // 重置时间
});
```

**PG扩展需求**：
- `pgvector` — 向量存储和余弦相似度检索
- `pg_cron`（可选） — 定时刷新Prophet预测

---

## 二十二、数据保留与归档策略（V2新增 D-030）

### 22.1 数据保留规则

| 数据类型 | 保留期限 | 归档策略 |
|---------|---------|---------|
| **评分结果** | 7天 | 过期后归档到历史表，保留最终评分和评级 |
| **Prophet预测** | 90天 | 过期后归档，仅保留预测值和实际值对比 |
| **产品Embedding** | 永久 | 变更时生成新版，旧版保留 |
| **政策变更记录** | 永久 | 任何EAC/平台政策变更永久保留 |
| **选品决策记录** | 永久 | 用于回溯分析和权重调优 |
| **销售表现数据** | 永久 | 用于评分准确度验证 |

### 22.2 数据归档表结构

```typescript
// 评分历史归档表（V2新增 D-030）
export const productScoresArchive = pgTable('product_scores_archive', {
  id: serial('id').primaryKey(),
  originalId: integer('original_id'),                    // 原始记录ID
  productId: integer('product_id'),
  compositeScore: decimal('composite_score', { precision: 5, scale: 4 }),
  grade: varchar('grade', { length: 1 }),
  shopStage: varchar('shop_stage', { length: 20 }),
  selectionMode: varchar('selection_mode', { length: 20 }),
  archivedAt: timestamp('archived_at').defaultNow(),
  reason: varchar('reason', { length: 20 }),           // expired/overwritten/manual
});

// 预测历史归档表（V2新增 D-030）
export const prophetForecastsArchive = pgTable('prophet_forecasts_archive', {
  id: serial('id').primaryKey(),
  originalId: integer('original_id'),
  categoryOrProduct: varchar('category_or_product', { length: 200 }),
  targetType: varchar('target_type', { length: 10 }),
  predictedValue: decimal('predicted_value', { precision: 10, scale: 2 }),
  actualValue: decimal('actual_value', { precision: 10, scale: 2 }), // 事后填充
  accuracy: decimal('accuracy', { precision: 5, scale: 4 }),           // 预测准确度
  archivedAt: timestamp('archived_at').defaultNow(),
});

// 政策变更记录表（V2新增 D-030）
export const policyChangeLog = pgTable('policy_change_log', {
  id: serial('id').primaryKey(),
  policyType: varchar('policy_type', { length: 50 }),   // eac/platform/logistics
  changeType: varchar('change_type', { length: 20 }),    // added/modified/removed
  affectedCategories: jsonb('affected_categories'),     // 受影响类目列表
  effectiveDate: date('effective_date'),
  description: text('description'),
  sourceUrl: varchar('source_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 22.3 归档执行策略

```typescript
// 归档任务配置（pg_cron）
const archiveJobs = [
  {
    name: 'archive-expired-scores',
    schedule: '0 3 * * *',  // 每天凌晨3点
    sql: `
      INSERT INTO product_scores_archive
      SELECT *, NOW(), 'expired'
      FROM product_scores
      WHERE calculated_at < NOW() - INTERVAL '7 days'
      AND id NOT IN (SELECT original_id FROM product_scores_archive);
      
      DELETE FROM product_scores
      WHERE calculated_at < NOW() - INTERVAL '7 days';
    `
  },
  {
    name: 'archive-expired-forecasts',
    schedule: '0 4 * * *',  // 每天凌晨4点
    sql: `
      INSERT INTO prophet_forecasts_archive
      SELECT pf.*, ps.sales_count as actual_value,
             1 - ABS(pf.predicted_value - ps.sales_count) / NULLIF(ps.sales_count, 0) as accuracy,
             NOW()
      FROM prophet_forecasts pf
      LEFT JOIN product_sales ps ON pf.category_or_product = ps.product_id
                                  AND pf.forecast_date = ps.sale_date
      WHERE pf.created_at < NOW() - INTERVAL '90 days'
      AND pf.id NOT IN (SELECT original_id FROM prophet_forecasts_archive);
      
      DELETE FROM prophet_forecasts
      WHERE created_at < NOW() - INTERVAL '90 days';
    `
  }
];
```

---

## 二十三、一期实现边界

### 一期完整实现 ✅

- [x] 五层递进算法架构（含第零层店铺阶段+卖家类型识别）
- [x] 硬约束过滤（EAC按卖家类型条件触发+新店价格200~1500₽硬约束+体积/重量降权）
- [x] 跟卖/精铺双模式算法（不同AHP矩阵+不同筛选条件+不同信号识别）
- [x] 跟卖→精铺自动转化触发（店龄/评价数/销量阈值检测）
- [x] AHP+熵权法组合赋权（品类×阶段自适应权重）
- [x] AHP-TOPSIS评分通道
- [x] Prophet时序预测（内置俄罗斯假期日历）
- [x] LLM推理层（信号解读+差异化建议+风险研判）
- [x] 四源交叉验证（至少2源有数据即可评分）
- [x] 评分明细可查看（可解释）
- [x] 策略权重可配置（含跟卖/精铺专属策略）
- [x] pgvector扩展 + Drizzle数据模型（含shop_profiles/eacConfig新表）
- [x] EAC认证一键切换能力（warning↔veto配置化）

### 一期降级实现 ⚠️（V2新增）

- [x] **语义评分通道（降级）**：用Embedding余弦相似度替代LightGBM
  - 原因：无标注数据，LightGBM无法训练
  - 语义评分含义：从"非结构化信号评分"变为"语义相似度评分"
  - 切换条件：积累3个月历史选品数据后训练LightGBM

- [x] **Prophet冷启动**：用平台级类目趋势替代SKU级预测
  - 原因：新系统无历史销量数据
  - 冷启动公式：综合评分 = 0.55×TOPSIS + 0.20×语义 + 0.10×类目趋势 + 0.15×机会
  - 切换条件：新店积累2周数据后启用SKU级Prophet

- [x] **综合评分权重**：标注"待验证"，冷启动期间自动调整
  - 初始权重：0.40/0.20/0.25/0.15（标准公式）
  - 冷启动权重：0.55/0.20/0.10/0.15（Prophet权重降低）
  - 验证后：根据历史选品效果回溯调优

### 一期新增实现 ✅（V2新增）

- [x] **跟卖→精铺转化状态流转**（D-027）
  - 创建新opportunity(mode=refine)关联原opportunity
  - 新opportunity继承targetCategoryId/targetProductId
  - 用精铺AHP矩阵重新评分，原opportunity保留

- [x] **店铺阶段自动检测逻辑**（D-028）
  - new→growing：店龄>3月+好评率>95%+月销>50单
  - growing→mature：≥3条高权重链接+月销>200单
  - 检测变化→推送通知→用户确认→切换模式→新矩阵重算

- [x] **SKU/变体粒度处理**（D-026）
  - SPU级：通用标题/描述/类目属性
  - SKU级：变体属性/独立定价/库存/图片
  - 选品算法按场景选择不同粒度

- [x] **Ozon API频率限制处理**（D-029）
  - 3600次/小时/店铺限制
  - 优先级队列：上架>评分>同步>采集
  - 令牌桶限流按优先级分配配额

- [x] **数据保留与归档策略**（D-030）
  - 评分7天、预测90天、Embedding变更重生成、政策变更永久保留
  - 归档任务自动执行

- [x] **学习闭环触发条件**（P1）
  - 100条数据积累后触发首次回溯
  - 之后每周自动回溯
  - 偏离≤20%达标，>20%自动触发权重微调（需人工确认）

### 二期迭代 🔄

- [ ] NSGA-II多目标优化（Pareto前沿替代TOPSIS单一排序）
- [ ] LightGCN品类关系图谱（高阶协同信号）
- [ ] LSTM/Transformer时序模型替代Prophet
- [ ] 贝叶斯优化自动调α（组合赋权参数）
- [ ] 历史选品效果回溯（卖了3个月后回算评分准确度）
- [ ] 强化学习自动优化权重
- [ ] 更多数据源（MPStats等第三方选品工具）
- [ ] LLMRec语义协同融合
- [ ] LLM Agent自然语言选品交互
- [ ] **LightGBM语义评分完整实现**（积累标注数据后替代余弦相似度）

---

## 二十四、决策记录更新

| 编号 | 决策 | 内容 | 日期 |
|------|------|------|------|
| D-010 | 选品算法架构 | 五层递进：硬约束过滤→组合赋权→双通道评分→Prophet预测→LLM推理（新增第零层：店铺阶段+卖家类型识别） | 06-08 |
| D-011 | 评分方法 | AHP-TOPSIS替代线性加权，解决维度补偿和权重主观问题 | 06-08 |
| D-012 | 语义评分通道 | LLM Embedding+LightGBM，处理文本信号，不用LLM直接打分 | 06-08 |
| D-013 | 时序预测 | Prophet，内置俄罗斯假期日历，yearly_seasonality=15 | 06-08 |
| D-014 | EAC认证 | **已修正**：按卖家类型区分——俄罗斯本土卖家一票否决，中国卖家风险提示（预留一键切换） | 06-08 |
| D-015 | 品类独立建模 | 每个品类独立的AHP权重矩阵，不一套通吃（扩展：跟卖/精铺也用不同矩阵） | 06-08 |
| D-016 | 综合评分公式 | 0.40×TOPSIS + 0.20×语义 + 0.25×Prophet + 0.15×机会指数（**待验证**，一期后回溯调优） | 06-08 |
| D-017 | 起店策略 | 跟卖+精铺双阶段：新店≤3月跟卖→3月后精铺，两种模式算法逻辑完全不同 | 06-08 |
| D-018 | 新店价格范围 | 新店跟卖阶段选品价格锁定200~1500₽ | 06-08 |
| D-019 | Prophet冷启动方案 | 新系统无历史数据，一期用平台级类目趋势替代SKU级Prophet预测，冷启动权重调整为0.10 | 06-08 |
| D-020 | LightGBM降级方案 | 一期无标注数据，用Embedding余弦相似度替代LightGBM，语义评分含义从"非结构化信号评分"变为"语义相似度评分" | 06-08 |
| D-021 | 冷启动权重调整 | 冷启动期间：Prophet权重0.10、TOPSIS权重0.55；积累2周数据后恢复标准权重 | 06-08 |
| D-022 | 学习闭环机制 | 100条数据触发首次回溯，每周自动回溯；偏离≤20%达标，>20%触发权重微调（需人工确认） | 06-08 |
| D-023 | 综合评分权重标注 | D-016权重为初始值，一期运行3个月后用历史选品效果回溯调优 | 06-08 |
| D-024 | 标注数据积累目标 | 积累3个月历史选品结果（100条选品→上架→销售表现闭环数据）后切换LightGBM | 06-08 |
| D-025 | 冷启动期数据要求 | SKU级销量时序14天后可用，类目级趋势开箱即用 | 06-08 |
| D-026 | SKU/变体粒度处理 | SPU（商品卡）+ SKU（变体）双层结构，选品算法按场景选择不同粒度 | 06-08 |
| D-027 | 跟卖→精铺转化状态流转 | 转化时创建新opportunity(mode=refine)关联原opportunity，继承targetCategoryId/targetProductId，用精铺AHP矩阵重新评分，原opportunity保留 | 06-08 |
| D-028 | 店铺阶段自动检测逻辑 | new→growing：店龄>3月+好评率>95%+月销>50单；growing→mature：≥3条高权重链接+月销>200单；检测变化推送通知，用户确认后切换selectionMode | 06-08 |
| D-029 | Ozon API频率限制处理 | 3600次/小时/店铺限制；优先级队列：上架>评分>同步>采集；令牌桶限流按优先级分配配额 | 06-08 |
| D-030 | 数据保留归档策略 | 评分保留7天、Prophet预测保留90天、产品Embedding变更重生成、政策变更永久保留；归档任务每日自动执行 | 06-08 |

---

> 本内容由 Coze AI 生成，请遵循相关法律法规及《人工智能生成合成内容标识办法》使用与传播。
