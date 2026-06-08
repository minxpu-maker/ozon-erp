---
AIGC:
    Label: "1"
    ContentProducer: 001191110102MACQD9K64018705
    ProduceID: 2566723632919907_0/project_7648227611545600271-files/docs/Ozon选品算法研究_report.md
    ReservedCode1: ""
    ContentPropagator: 001191110102MACQD9K64028705
    PropagateID: 2566723632919907#1780896898129
    ReservedCode2: ""
---
# Ozon俄罗斯电商平台AI智能选品系统：顶尖算法研究与落地方案

> 完成日期：2026-06-08

## Executive Summary

当前五维加权评分模型（市场需求度/竞争激烈度/利润空间/供给可行性/合规风险）是一个有效的MVP起点，但在三个维度上存在结构性瓶颈：**线性加权无法处理目标冲突**（如高需求往往伴随高竞争）、**静态评分无法捕捉时序动态**（如季节性爆发和趋势衰退）、**规则引擎无法理解语义信息**（如品类关联和产品描述）。本研究基于对Jungle Scout、Helium 10、MPStats等头部选品工具的算法逆向分析，以及阿里巴巴RecSys、ACM AICCC等学术前沿的深度调研，提出一套**"规则→传统ML→LLM"三层递进**的混合智能选品架构。

**一期推荐方案**（Next.js+PG+Drizzle可落地的核心升级）：用**AHP-TOPSIS**替代线性加权（解决目标冲突和权重主观性问题），用**Prophet**做销量/趋势预测（解决时序动态问题），用**LLM嵌入+LightGBM**处理品类关联和语义理解（解决语义缺失问题）。这三个组件均可在PG中用SQL+Python UDF实现，无需额外基础设施。

**二期升级路径**：引入**NSGA-II多目标优化**替代TOPSIS（产出Pareto前沿而非单一排序），引入**LightGCN图神经网络**构建品类关系图谱（捕捉高阶协同信号），引入**LLM Agent**做自然语言选品交互和推理验证。

**俄罗斯市场特有维度**必须作为硬约束纳入：2026年EAC认证新规已成为一票否决项（无证商品100%下架+罚款货值300%）[(上海经合)](https://www.cu-tr.com.cn/page8?article_id=9798)；物流瓶颈导致体积/重量成为利润决定因素；极端季节性（冬季长达6个月+新年峰值占全年GMV比例极高）要求时序模型必须内嵌俄罗斯假期日历；卢布汇率波动要求利润模型必须包含汇率风险敞口。

---

## 一、业界标杆：头部选品工具的算法逆向

### 1.1 Jungle Scout — AccuSales™算法

Jungle Scout是亚马逊生态最成熟的选品工具，其核心AccuSales™算法每天处理**20亿个数据点**，月度服务器开销近10万美元 [(Jungle Scout中国官网)](https://www.junglescout.cn/accusales/)。算法核心架构：

**数据层**：多源异构数据融合
- 自愿共享的真实销售数据（最宝贵的数据源）
- 产品BSR（Best Sellers Rank）排名数据
- 库存数据（开发了突破999限制的专有库存追踪系统）
- 价格、评论、父/子品类数据

**模型层**：品类独立模型 + 异常值过滤
- **每个品类独立建模**，每月更新模型参数（因为不同品类的BSR-销量映射关系完全不同）
- 专门过滤刷单等异常值，防止干扰估计
- 明确放弃了线性回归等标准算法，开发了**专有的非线性算法系统**

**评估层**：Opportunity Score（1-10分）
- 实测偏差：日用品类约19%，季节性品类约34%，服饰类约41% [(AMZBase)](https://amzbase.com/guides/jungle-scount-guide/)

**核心启示**：Jungle Scout证明了**品类独立建模**和**非线性关系**的必要性——Ozon平台同样需要针对不同品类（如俄罗斯冬季服装vs夏季配件）建立独立的评分参数。

### 1.2 Helium 10 — 双模式评分体系

Helium 10提供了两种互补的评分模式 [(Helium 10 Coupons)](https://helium10.coupons/success-score/)：

| 评分模式 | 评估维度 | 自定义 | 适用场景 |
|---------|---------|-------|---------|
| **Multi-Factor** | 市场成熟度、平均销量、销量趋势、平均价格、销售集中度 | 不可 | 全局健康度评估 |
| **Two-Factor** | 最低月收入 + 最大评论数 | 可自定义阈值 | 快速筛选过滤 |

其Product Launchpad的**Idea Scorecard**更是覆盖了6个维度：市场规模、趋势、竞争、物流、直觉判断、未来潜力 [(Helium 10 Blog)](https://www.helium10.com/blog/product-launchpad/)。

**核心启示**：Helium 10的**双模式设计**（一个全局评估+一个自定义筛选）值得借鉴——Ozon选品系统可提供"AI评分"（系统优化权重）和"自定义评分"（用户自定义权重阈值）两种模式。

### 1.3 MPStats — Ozon生态最大分析工具

MPStats是Ozon平台最主流的第三方分析工具，月费6990₽，提供**30+品类参数**分析 [(MPStats官网)](https://mpstats.io/instruments/ozon/analytics/)。核心指标体系：

| 维度 | 核心指标 |
|------|---------|
| 市场规模 | 销量、收入、卖家数、品牌数 |
| 价格分析 | 平均价格、中位价格、价格分布图 |
| 竞争格局 | Top卖家份额图、品牌集中度、垄断度 |
| 产品质量 | 平均评分、评论数、新品比例 |
| 运营效率 | 流失收入（缺货导致的收入损失）、库存周转 |
| 地理分布 | 区域销量分布、竞对区域对比 |
| 搜索流量 | Top100搜索词、关键词排名 |

**AI功能**：提供AI辅助选品助手，可自然语言提问获取品类推荐 [(MPStats选品指南)](https://mpstats.io/media/ozon/vybrat-tovar-dlya-prodazhi)。

**核心启示**：MPStats的**"流失收入"指标**极具Ozon特色——衡量因缺货/价格不当而错失的收入，应纳入选品模型的"供给可行性"维度。其**地理维度**也值得关注——俄罗斯地域广阔，远东与莫斯科的消费偏好差异巨大。

### 1.4 速卖通/AliExpress工具 — FindNiche与AliShopping Tools

**FindNiche**定义了两个关键指数 [(FindNiche/ZBase)](https://cdn.zbaseglobal.com)：
- **机会指数**：Top100商品名单变动频率，指数越高代表新品越容易进入
- **垄断指数**：Top10订单量占Top100的比例，指数越高代表垄断越严重

**AliShopping Tools**的Dropship Score [(AS Tools Blog)](https://news.astools.app/en/blog/how-to-find-winning-products-aliexpress-2026)：

$$\text{Score} = 0.30 \times \text{ProductQuality} + 0.30 \times \text{ProfitPotential} + 0.20 \times \text{MarketOpportunity} + 0.20 \times \text{RiskLevel}$$

**核心启示**：FindNiche的**机会指数**和**垄断指数**可直接移植到Ozon场景——用Ozon品类Top100的SKU变动率和Top10卖家份额来衡量品类开放度。

### 1.5 业界标杆综合对比

| 工具 | 核心算法 | 评分维度 | 关键创新 | Ozon适用度 |
|------|---------|---------|---------|-----------|
| Jungle Scout AccuSales | 品类独立非线性模型 | BSR+销量+库存+价格 | 999库存突破+异常值过滤 | ★★★☆ |
| Helium 10 Success Score | 双模式加权评分 | 市场成熟度+5维+自定义 | 可自定义阈值筛选 | ★★★☆ |
| MPStats | 多维聚合+AI助手 | 30+参数含地理/流失收入 | Ozon专属+AI问答 | ★★★★★ |
| FindNiche | 机会指数+垄断指数 | 品类变动率+集中度 | 量化市场开放度 | ★★★★ |
| AliShopping Tools | 四维加权0-100分 | 质量30%+利润30%+机会20%+风险20% | 趋势阶段判定 | ★★★☆ |

---

## 二、进阶算法：从线性加权到智能优化

### 2.1 AHP-TOPSIS：替代线性加权的最优一期方案

**为什么需要替代线性加权？** 当前的五维加权评分模型：

$$S = w_1 \cdot D + w_2 \cdot (1-C) + w_3 \cdot P + w_4 \cdot F + w_5 \cdot (1-R)$$

存在三个根本问题：
1. **权重主观性**：$w_i$靠人工设定，缺乏数学依据
2. **维度替代性假设**：线性加权隐含假设各维度可互相补偿（高利润可以补偿高风险），但现实中EAC不合规是**一票否决**，不可被利润补偿
3. **无法处理冲突**：市场需求度和竞争激烈度天然正相关，线性加权会"双重惩罚"

**AHP（层次分析法）解决权重问题**：

AHP通过两两比较构建判断矩阵，用1-9标度量化专家判断 [(PMC/NCBI)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4775722/)：

$$A = \begin{pmatrix} 1 & a_{12} & \cdots & a_{1n} \\ a_{21} & 1 & \cdots & a_{2n} \\ \vdots & \vdots & \ddots & \vdots \\ a_{n1} & a_{n2} & \cdots & 1 \end{pmatrix}$$

其中$a_{ij}$表示第$i$个维度相对第$j$个维度的重要程度。通过特征向量法求权重：

$$A \cdot \vec{w} = \lambda_{max} \cdot \vec{w}$$

**一致性检验**（CR < 0.1才通过）：

$$CI = \frac{\lambda_{max} - n}{n - 1}, \quad CR = \frac{CI}{RI}$$

**TOPSIS解决排序问题**：

给定$m$个候选产品、$n$个评价指标：

**Step 1**：标准化决策矩阵

$$r_{ij} = \frac{x_{ij}}{\sqrt{\sum_{i=1}^{m} x_{ij}^2}}$$

**Step 2**：加权标准化矩阵

$$v_{ij} = w_j \cdot r_{ij}$$

**Step 3**：确定正理想解$A^+$和负理想解$A^-$

$$A^+ = \{v_1^+, v_2^+, \cdots, v_n^+\}, \quad A^- = \{v_1^-, v_2^-, \cdots, v_n^-\}$$

**Step 4**：计算与正/负理想解的欧氏距离

$$D_i^+ = \sqrt{\sum_{j=1}^{n}(v_{ij} - v_j^+)^2}, \quad D_i^- = \sqrt{\sum_{j=1}^{n}(v_{ij} - v_j^-)^2}$$

**Step 5**：计算相对贴近度（最终评分）

$$C_i = \frac{D_i^-}{D_i^+ + D_i^-}, \quad 0 \leq C_i \leq 1$$

$C_i$越接近1，该产品越优。

**Ozon选品的AHP层次结构设计**：

```
                    [最优选品]
                   /    |    \     \     \
        [市场需求] [竞争格局] [利润空间] [供给可行] [合规风险]
        /    \     /    \     /    \     /    \     /    \
    搜索量 增长率 卖家数 垄断度 毛利率 ROI 物流费 时效 EAC 危险品
```

**一期实现要点**：
- AHP判断矩阵可由领域专家一次性设定（或通过历史数据回归得出），存储在PG的JSON字段中
- TOPSIS计算可完全用SQL窗口函数实现，无需额外计算引擎
- 增加"硬约束"层：合规风险不参与TOPSIS排序，而是作为**一票否决前置过滤**

### 2.2 多目标优化（Pareto前沿）：二期核心升级

**为什么TOPSIS还不够？** TOPSIS最终仍然产出一个标量$C_i$进行排序，隐含了"各目标可以折中"的假设。但真实选品场景中，卖家有不同的策略偏好：
- 激进型卖家：偏好高需求+高竞争（冲量）
- 稳健型卖家：偏好中需求+低竞争（保利润）
- 新手卖家：偏好低门槛+低风险（试水）

**Pareto前沿**允许同时保留多种策略的最优解，而非强制折中。

阿里巴巴在RecSys'19论文中证明了CTR和GMV两个目标存在显著冲突（Pearson相关系数-0.34），并提出了保证Pareto效率的加权聚合+KKT条件框架 [(ACM RecSys'19)](http://www.yongfeng.me/attach/lin-recsys2019.pdf)。

**NSGA-II算法** [(PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0319182)：

对于Ozon选品，定义三个优化目标：

$$\max f_1(\vec{x}) = \text{MarketDemand}(\vec{x})$$
$$\max f_2(\vec{x}) = \text{ProfitMargin}(\vec{x})$$
$$\min f_3(\vec{x}) = \text{CompetitionLevel}(\vec{x})$$

其中$\vec{x}$是一个产品的特征向量。NSGA-II的执行流程：

1. **初始化种群**：从Ozon产品库中随机采样$N$个产品
2. **快速非支配排序**：将种群分为Pareto前沿层$F_1, F_2, \ldots$
3. **拥挤距离计算**：在每层内按拥挤距离排序，保持解的多样性
4. **选择+交叉+变异**：锦标赛选择→SBX交叉→多项式变异
5. **精英保留**：合并父代和子代，选取前$N$个进入下一代

**输出**：一条Pareto前沿曲线，横轴为竞争水平，纵轴为需求-利润综合得分。用户可在曲线上选择符合自身策略的操作点。

**与TOPSIS的互补关系**：一期用TOPSIS给出确定排序；二期增加NSGA-II给出Pareto前沿，让用户在"高需求高竞争"vs"低需求低竞争"之间自主选择。

### 2.3 协同过滤：商品-用户匹配逻辑

协同过滤在选品场景的应用不同于推荐场景——选品是**卖家找品**而非**买家找货**。但核心思想可以迁移：

**Item-based CF用于品类关联发现**：
- 构建产品共购矩阵（Ozon上经常被同一买家同时购买的产品对）
- 计算物品相似度：$\text{sim}(i, j) = \cos(\vec{r}_i, \vec{r}_j)$
- 用途：当卖家选了一个品，自动推荐关联品（如选了保温杯→推荐保温袋）

**User-based CF用于卖家画像匹配**：
- 构建卖家-产品矩阵（哪些卖家成功运营了哪些品类）
- 找到与当前卖家最相似的"成功卖家"，推荐他们运营的品类
- 这本质上是一个"卖家群体智慧"选品方法

**一期简化实现**：在PG中用SQL实现item-based CF
```sql
-- 计算品类共现相似度
SELECT category_a, category_b, 
       SUM(co_purchase_count) / SQRT(SUM(a_total) * SUM(b_total)) AS similarity
FROM co_purchase_matrix
GROUP BY category_a, category_b
HAVING similarity > 0.3
ORDER BY similarity DESC;
```

### 2.4 时间序列预测：Prophet驱动销量/趋势预测

**Prophet模型** [(MCPAnalytics)](https://mcpanalytics.ai/whitepapers/whitepaper-prophet)采用加性分解：

$$y(t) = g(t) + s(t) + h(t) + \varepsilon(t)$$

其中：
- $g(t)$：趋势函数（分段线性或logistic增长）
- $s(t)$：季节性函数（傅里叶级数展开）
- $h(t)$：假期/事件效应
- $\varepsilon(t)$：误差项

**对Ozon/Russia的关键适配**：

1. **俄罗斯假期日历**：必须内嵌俄罗斯特定假期
   - Новогодние праздники（新年假期，1/1-1/8）
   - 8 Марта（妇女节，3/8）
   - 23 Февраля（祖国保卫者日，2/23）
   - День Победы（胜利日，5/9）
   - 1 Сентября（开学日，9/1）
   - 11.11 大促（Ozon Mega Sale）

2. **极端季节性建模**：
   - 年季节性：冬季（10月-3月）vs夏季（4月-9月）是完全不同的消费模式
   - 供暖季/非供暖季对家电类产品需求影响巨大
   - 需要设置更高的Fourier阶数（建议`yearly_seasonality=15`）

3. **趋势变化点检测**：俄罗斯市场受制裁和进口替代影响，品类趋势变化剧烈，需要设置较多的变化点（`n_changepoints=50`）

**电商预测最佳实践** [(TheNeuralBase)](https://theneuralbase.com/ai-for-ecommerce/learn/advanced/time-series-ml/)：
- **高量SKU**（>50件/周）：XGBoost + lag特征（7天/30天滚动均值、YoY增长率）
- **稳定品类**：Holt-Winters指数平滑
- **有促销日历**：Prophet（预测精度提升28%，缺货率降低34%）
- **稀疏数据**：简单指数平滑，不要用深度学习

**一期实现**：
- 用Python的`prophet`库在后台定时运行预测任务
- 预测结果写入PG的`product_forecasts`表
- API返回时将预测值作为"市场需求度"维度的一个子指标

### 2.5 图网络：品类关系图谱

图神经网络（GNN）在电商推荐中已证明有效 [(ResearchGate)](https://www.researchgate.net/)。在Amazon产品共购网络上，四种GNN架构对比：

| 模型 | 适用场景 | 是否用特征 | 可扩展性 | 自适应邻居权重 |
|------|---------|----------|---------|-------------|
| LightGCN | 纯CF | 否 | ★★★★★ | 否 |
| GraphSAGE | 通用链接预测 | 是 | ★★★★ | 否 |
| GAT | 需注意力加权 | 是 | ★★★ | 是 |
| PinSAGE | 大规模Web推荐 | 是 | ★★★★★ | 是 |

**Ozon品类关系图谱设计**：

```
节点类型：Product, Category, Brand, Seller, SearchQuery
边类型：
  - co_purchase（共购关系，权重=共购频次）
  - same_category（同品类）
  - substitute（替代关系，从搜索词推断）
  - complementary（互补关系，从购物篮分析推断）
  - brand_affinity（品牌关联）
```

**知识图谱推理** [(MDPI Mathematics)](https://www.mdpi.com/2227-7390/11/22/4709/htm)可用于推断产品间的互补和替代关系，提供可解释的推理路径。

**一期简化**：用PG的关系型存储模拟简单图结构（产品→品类的树形结构+共购关联表），不引入图数据库。
**二期升级**：引入Neo4j或Apache AGE（PG图扩展），部署LightGCN进行品类嵌入学习。

---

## 三、AI/ML增强：LLM + 传统模型的混合架构

### 3.1 混合架构设计原则

基于ACM AICCC 2025的研究 [(ACM)](https://dl.acm.org/doi/full/10.1145/3789982.3790065)，三阶段混合AI系统是最合理的架构选择：

| 层级 | 技术选型 | 处理内容 | 延迟 | 成本 |
|------|---------|---------|------|------|
| **Stage 1: 规则引擎** | 硬约束过滤 | EAC合规、品类限制、价格区间、体积重量 | <1ms | 极低 |
| **Stage 2: 传统ML** | AHP-TOPSIS + Prophet + LightGBM | 多维评分、趋势预测、品类关联 | <10ms | 低 |
| **Stage 3: LLM验证** | LLM API（按需调用） | 语义理解、异常解释、选品推理 | 100-500ms | 中 |

**核心原则**：LLM不替代传统模型，而是**补充**传统模型无法处理的部分。LLM推理成本约$0.03-0.30/次，LightGBM推理<$0.0001/次 [(TheNeuralBase)](https://theneuralbase.com/lightgbm/learn/advanced/hybrid-ml-and-llm-architectures/)。

### 3.2 哪些环节用LLM，哪些用传统模型？

| 环节 | 传统模型 | LLM | 理由 |
|------|---------|-----|------|
| **EAC合规判断** | ✅ 规则引擎 | ❌ | 合规是确定性规则，不需要语义理解 |
| **市场需求评分** | ✅ Prophet+XGBoost | ❌ | 时序预测需要数值精度，LLM会"幻觉"数字 |
| **竞争程度评估** | ✅ TOPSIS | ❌ | 基于结构化指标（卖家数、份额、壁垒） |
| **利润计算** | ✅ 公式计算 | ❌ | 纯数值计算 |
| **品类关联发现** | ✅ CF+知识图谱 | 🔶 辅助 | CF发现统计关联，LLM解释语义原因 |
| **产品描述理解** | ❌ | ✅ | 非结构化文本→结构化特征 |
| **趋势解释** | ❌ | ✅ | "为什么这个品类突然爆发？" |
| **选品建议生成** | ❌ | ✅ | 自然语言选品报告 |
| **异常检测解释** | ❌ | ✅ | "为什么这个SKU的预测销量突然下降？" |
| **竞对策略推断** | 🔶 辅助 | ✅ | 从评论/描述中推断竞对定位 |

### 3.3 一期LLM集成方案：嵌入提取+LightGBM

这是被验证最适合生产的LLM集成模式 [(TheNeuralBase)](https://theneuralbase.com/lightgbm/learn/advanced/hybrid-ml-and-llm-architectures/)：

```
[产品标题+描述文本] → LLM Embedding API → 768维向量
                                              ↓
[结构化特征：价格/销量/评分/卖家数/...] → 特征拼接 → [768+N维] → LightGBM → 选品评分
```

**具体实现**：
1. 对Ozon每个SKU的标题+描述，调用embedding API（如text-embedding-3-small）生成向量
2. 向量缓存在PG的`vector`类型字段中（PG 16+原生支持pgvector）
3. 将向量与结构化特征（价格、销量、评分等）拼接
4. 用LightGBM训练选品评分模型
5. 推理时：LightGBM推理<1ms，embedding可离线预计算

**优势**：
- LLM作为无状态特征提取器，不需要微调
- LightGBM处理分类特征和缺失值的能力远超神经网络
- 推理延迟极低（LightGBM<1ms + 缓存的embedding 0ms）
- 特征重要性可解释，能看出是语义维度还是数值维度更关键

### 3.4 二期LLM集成方案：PALR框架+LLM Agent

**PALR框架**（检索-排序两阶段）[(CSDN文库)](https://wenku.csdn.net/column/nscn32ny9br)：

```
Stage 1: 协同过滤召回
  [卖家历史选品偏好] → User-Item矩阵 → ALS分解 → Top 500候选品类

Stage 2: LLM语义排序
  [候选品类列表 + 市场数据 + 卖家画像] → LLM Prompt → 排序+理由
```

**LLM Agent选品助手**：
- 用户："我想在Ozon上卖冬季户外用品，预算5万卢布，有什么推荐？"
- Agent：调用Prophet获取冬季户外趋势→调用TOPSIS评分→调用CF找关联品类→生成自然语言报告

---

## 四、俄罗斯市场特有因素

### 4.1 EAC认证：一票否决的合规红线

2026年俄联邦第1669号决议实施后，EAC认证已成为Ozon选品最关键的合规门槛 [(上海经合)](https://www.cu-tr.com.cn/page8?article_id=9798)：

| 规定 | 具体要求 | 对选品的影响 |
|------|---------|------------|
| 仅俄本土签发有效 | 哈萨克斯坦/白俄罗斯等EAEU成员国证书无效 | 中国卖家必须委托俄境内法人 |
| 全品类需俄本土实测 | 样品需进口报关+俄实验室全项测试 | 增加认证成本和时间（5-20工作日） |
| 页面强制公示认证信息 | 6项信息必须在商品页首屏展示 | 缺失即下架 |
| 海关智能核验 | FGIS数据库实时对接 | 假证秒识别 |
| 罚款最高货值300% | 平台与卖家连带责任 | 违规成本极高 |

**模型设计**：将EAC合规作为**硬约束**（而非评分维度），在TOPSIS之前进行前置过滤：

```python
def filter_by_compliance(product):
    """EAC合规一票否决"""
    if product.requires_eac and not product.has_valid_eac:
        return REJECT  # 不进入评分流程
    if product.category in HIGH_RISK_CATEGORIES:  # 儿童/电子/食品
        if not product.has_russian_lab_report:
            return REJECT
    return PASS  # 进入TOPSIS评分
```

**需EAC认证的高风险品类**：儿童用品、电子电气、食品接触材料、化妆品、医疗器械、个人防护设备。

### 4.2 极端季节性

俄罗斯的季节性远强于中国/东南亚市场，主要体现在：

- **冬季消费峰值**：10月-3月，保暖服装、供暖设备、冬季运动用品销量可达夏季的3-5倍
- **新年消费爆发**：12月是全年最大消费月，礼品、装饰品、食品需求激增
- **开学季**：9月1日前2-3周是文具、书包、校服的集中采购期
- **别墅季（Дачный сезон）**：5月-9月，园艺工具、烧烤设备、户外家具需求上升

**Prophet适配方案**：
```python
model = Prophet(
    yearly_seasonality=15,  # 提高Fourier阶数捕捉极端季节性
    weekly_seasonality=3,
    changepoint_prior_scale=0.1,  # 允许更多趋势变化
    n_changepoints=50,
)
# 添加俄罗斯特定假期
model.add_country_holidays(country_name='Russia')
# 自定义Ozon大促事件
model.add_regressor('is_mega_sale')  # 11.11, 黑五等
model.add_regressor('is_school_season')  # 8月底-9月初
model.add_regressor('heating_season')  # 供暖季（10月-4月）
```

### 4.3 物流瓶颈

2025年俄罗斯电商物流面临严重瓶颈 [(Logistics.ru)](https://logistics.ru/internet-torgovlya-i-fulfilment/elektronnaya-torgovlya-vyshla-iz-rezhima-uskoreniya-pochemu-rynok)：

- 平均订单金额降至**1610₽**（-5% YoY），小件高频订单增加物流压力
- 仓库接收/卸货位紧张，大型节点数天内的slot被占满
- 配送时间从"次日达"退化为3天以上，部分区域1-3周
- 9月Ozon配送延误达到2022年以来最严重水平

**选品模型适配**：

$$\text{LogisticsScore} = f(\text{体积}, \text{重量}, \text{易碎度}, \text{存储条件})$$

Ozon实战卖家的建议 [(vc.ru)](https://vc.ru/marketplace/2286168-kak-vybrat-tovar-dlya-ozon-bez-riska-poter)：
- 产品体积**≤0.5升**（最佳是鼠标大小的产品）
- 价格区间**500-2500₽**（太低物流费吃利润，太高资金占用大）
- 避免易碎品（退换货率极高）
- 避免大件家具/家电（FBO仓储费高）

### 4.4 汇率波动

卢布汇率波动极大（2022年以来从60到120再回到90区间），直接影响：
- 进货成本（CNY→RUB结算）
- 定价策略（汇率波动→需动态调整售价）
- 利润空间（汇率不利时利润可能归零）

**模型适配**：利润计算中必须包含汇率风险敞口：

$$\text{AdjustedProfit} = \text{Revenue} - \text{Cost} \times \text{FXRate} \times (1 + \text{FXRiskPremium})$$

其中$\text{FXRiskPremium}$建议设为10-15%（基于历史波动率）。

### 4.5 俄罗斯市场特有维度汇总

| 维度 | 一期实现方式 | 影响程度 | 数据来源 |
|------|------------|---------|---------|
| EAC合规 | 硬约束前置过滤 | ★★★★★ 一票否决 | Ozon Seller API + FGIS |
| 季节性 | Prophet内置俄假期日历 | ★★★★★ 极强 | Ozon销售历史数据 |
| 物流约束 | 体积/重量评分降权 | ★★★★ 高 | 产品规格数据 |
| 汇率风险 | 利润公式乘风险系数 | ★★★★ 高 | CBR汇率API |
| 地理差异 | 莫斯科vs远东分区评分 | ★★★ 中 | Ozon地理销售数据 |
| 本地化需求 | 俄语描述质量评分 | ★★★ 中 | LLM嵌入相似度 |

---

## 五、可落地方案：一期实现+二期升级

### 5.1 一期方案（Next.js + PG + Drizzle）

**架构概览**：

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │选品评分   │ │趋势预测   │ │品类关联   │ │AI选品助手  │ │
│  │Dashboard │ │Prophet   │ │CF推荐    │ │LLM Chat   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ API Routes
┌──────────────────────┴──────────────────────────────────┐
│                   Backend (Next.js API)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │合规过滤   │ │AHP-TOPSIS│ │Prophet   │ │Embed+LGBM │ │
│  │规则引擎   │ │评分引擎  │ │预测服务  │ │语义评分   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ Drizzle ORM
┌──────────────────────┴──────────────────────────────────┐
│                  PostgreSQL 16+                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │products  │ │scores    │ │forecasts │ │embeddings  │ │
│  │表        │ │表        │ │表        │ │(pgvector)  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**核心数据模型**（Drizzle Schema）：

```typescript
// 产品基础表
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull(),
  title: text('title'),
  titleEmbedding: vector('title_embedding', { dimensions: 1536 }), // pgvector
  category: varchar('category', { length: 200 }),
  price: decimal('price', { precision: 10, scale: 2 }),
  weight: decimal('weight_kg', { precision: 6, scale: 3 }),
  volume: decimal('volume_liters', { precision: 6, scale: 2 }),
  requiresEac: boolean('requires_eac').default(false),
  hasEac: boolean('has_eac').default(false),
  // ... 其他基础字段
});

// 评分结果表
export const productScores = pgTable('product_scores', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  // AHP-TOPSIS 评分
  topsisScore: decimal('topsis_score', { precision: 5, scale: 4 }),
  demandScore: decimal('demand_score', { precision: 5, scale: 4 }),
  competitionScore: decimal('competition_score', { precision: 5, scale: 4 }),
  profitScore: decimal('profit_score', { precision: 5, scale: 4 }),
  supplyScore: decimal('supply_score', { precision: 5, scale: 4 }),
  complianceScore: decimal('compliance_score', { precision: 5, scale: 4 }),
  // 趋势预测
  predictedSales30d: integer('predicted_sales_30d'),
  trendDirection: varchar('trend_direction', { length: 10 }), // up/down/stable
  // 语义评分
  semanticScore: decimal('semantic_score', { precision: 5, scale: 4 }),
  // 综合评分
  compositeScore: decimal('composite_score', { precision: 5, scale: 4 }),
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

// 预测结果表
export const forecasts = pgTable('forecasts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  forecastDate: date('forecast_date'),
  predictedSales: integer('predicted_sales'),
  predictedRevenue: decimal('predicted_revenue', { precision: 12, scale: 2 }),
  lowerBound: integer('lower_bound'),
  upperBound: integer('upper_bound'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
});

// AHP权重配置表
export const ahpWeights = pgTable('ahp_weights', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 200 }), // 品类级权重
  weightMatrix: jsonb('weight_matrix').notNull(), // 判断矩阵
  consistencyRatio: decimal('consistency_ratio', { precision: 5, scale: 4 }),
  isActive: boolean('is_active').default(true),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**一期评分算法完整流程**：

```python
def score_product(product, ahp_weights, forecast, embedding_features):
    """一期完整评分流程"""
    
    # Step 1: 硬约束过滤（一票否决）
    if product.requires_eac and not product.has_eac:
        return None  # EAC不合规直接排除
    if product.price < 500 or product.price > 25000:  # RUB
        return None  # 价格区间过滤
    if product.volume > 10:  # 升
        return None  # 大件物流过滤
    
    # Step 2: AHP-TOPSIS 评分
    criteria = {
        'demand': normalize(product.monthly_sales, 'demand'),
        'growth': normalize(forecast.trend_slope, 'growth'),
        'competition': normalize(1 - product.competition_index, 'competition'),  # 反转
        'profit': normalize(product.gross_margin, 'profit'),
        'supply': normalize(calculate_supply_score(product), 'supply'),
    }
    topsis_score = topsis_calculate(criteria, ahp_weights)
    
    # Step 3: Prophet 趋势评分
    trend_score = calculate_trend_score(forecast)
    # 趋势阶段：Emerging(1.0) > Growing(0.8) > Peak(0.5) > Declining(0.1)
    
    # Step 4: 语义评分（LightGBM with embeddings）
    semantic_score = lightgbm_predict(
        structured_features=extract_structured_features(product),
        embedding_features=embedding_features,
    )
    
    # Step 5: 综合评分
    composite = (
        0.40 * topsis_score +      # 多维评分权重最大
        0.25 * trend_score +        # 趋势预测次之
        0.20 * semantic_score +     # 语义关联
        0.15 * opportunity_index    # 品类机会指数
    )
    
    return {
        'composite_score': composite,
        'topsis_score': topsis_score,
        'trend_score': trend_score,
        'semantic_score': semantic_score,
        'trend_direction': forecast.trend_direction,
        'predicted_sales_30d': forecast.predicted_sales,
    }
```

**一期技术栈依赖**：

| 组件 | 技术 | 用途 | 额外依赖 |
|------|------|------|---------|
| AHP-TOPSIS | TypeScript/SQL | 评分引擎 | 无 |
| Prophet | Python (prophet库) | 时序预测 | Python运行时 |
| Embedding | OpenAI API / 本地模型 | 文本向量化 | API Key |
| LightGBM | Python (lightgbm库) | 语义评分模型 | Python运行时 |
| pgvector | PG扩展 | 向量存储与检索 | PG 16+ |
| 定时任务 | node-cron / pg_cron | 预测刷新 | 无 |

**一期开发周期估算**：
- Week 1-2：AHP-TOPSIS评分引擎 + Drizzle数据模型
- Week 3-4：Prophet预测服务 + 俄罗斯假期日历
- Week 5-6：Embedding预计算 + LightGBM训练Pipeline
- Week 7-8：前端Dashboard + API集成 + 测试

### 5.2 二期升级方案

| 升级项 | 一期 | 二期 | 技术增量 |
|--------|------|------|---------|
| 评分模型 | AHP-TOPSIS | NSGA-II Pareto前沿 | pymoo/DEAP库 |
| 品类关联 | SQL-based CF | LightGCN图神经网络 | PyTorch+DGL |
| 语义理解 | Embedding+LightGBM | LLMRec（LightGCN+LLM+对比学习） | 微调pipeline |
| 用户交互 | 静态Dashboard | LLM Agent自然语言选品 | LangChain/Agent框架 |
| 数据存储 | PG关系型 | PG+Neo4j图数据库 | Neo4j/Apache AGE |
| 实时性 | 批量计算（日级） | 流式计算（分钟级） | Redis+Kafka |

**二期新增基础设施**：
- Python ML服务（独立微服务，运行LightGCN训练和推理）
- Redis缓存层（embedding和评分结果缓存）
- Neo4j图数据库（品类关系图谱）
- LLM Agent服务（选品对话+推理验证）

---

## 六、总结与行动建议

### 6.1 核心结论

1. **AHP-TOPSIS是最优一期评分替代方案**：解决了线性加权的三个根本问题（权重主观性、维度替代性、目标冲突），且完全可用SQL实现，零额外基础设施成本。

2. **Prophet是俄罗斯市场最合适的预测模型**：其假期效应建模和季节性分解天然适配俄罗斯极端季节性，预测精度比ARIMA/LSTM更适合电商场景。

3. **LLM应作为特征提取器而非最终决策者**：Embedding+LightGBM架构兼顾语义理解能力和推理效率，是目前生产系统的最佳实践。

4. **EAC合规必须作为硬约束而非评分维度**：2026年新规后，合规不通过=100%下架，不存在"高利润补偿高风险"的可能。

5. **品类独立建模是关键差异化**：Jungle Scout的核心经验——不同品类的评分参数差异巨大，统一模型会严重失真。

### 6.2 优先级行动清单

| 优先级 | 行动项 | 预期收益 | 工作量 |
|--------|--------|---------|--------|
| P0 | EAC合规硬约束前置过滤 | 避免选品违规下架 | 1天 |
| P0 | AHP-TOPSIS替代线性加权 | 评分准确度显著提升 | 1周 |
| P1 | Prophet销量趋势预测 | 捕捉季节性和趋势 | 2周 |
| P1 | 品类机会指数/垄断指数 | 量化市场开放度 | 3天 |
| P2 | LLM Embedding+LightGBM | 语义理解能力 | 2周 |
| P2 | 俄罗斯假期日历集成 | 预测精度提升 | 3天 |
| P3 | NSGA-II Pareto前沿 | 多策略选品 | 2周 |
| P3 | LightGCN品类图谱 | 高阶关联发现 | 4周 |

---

> 本内容由 Coze AI 生成，请遵循相关法律法规及《人工智能生成合成内容标识办法》使用与传播。
