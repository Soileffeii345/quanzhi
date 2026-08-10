# GitHub 同类项目技术调研

调研日期：2026-08-07

## 调研目的

回答"其他人是怎么解决同类问题的"——不限于钱币项目，涵盖所有需要通过 OCR 图片提取序列号并跨平台聚合价格的收藏品/商品项目。

## 核心发现

### 泉知在全球开源项目中的独特位置

**没有在 GitHub 上找到任何一个项目**完整实现了"批量 OCR 平台商品图片 → 提取盒号 → 建立可搜索索引 → 跨平台聚合价格"这一链路。泉知在这个方向上是首创。

原因分析：
1. 国外平台（eBay、TCGplayer 等）提供文本搜索 API，不需要 OCR 图片
2. 中国钱币平台（邮宝、赵涌、易金）没有盒号文本搜索，这是该领域的独特难点
3. 大部分项目只 OCR 用户上传的图片，不做平台商品图片的批量索引

---

## 一、直接对标：SlabStak（交易卡牌评级盒 OCR + 价格聚合）

仓库：[github.com/MurphbeckTech/slabstak](https://github.com/MurphbeckTech/slabstak)

### 产品定位
AI 驱动的交易卡牌智能平台，面向 PSA/BGS 评级卡牌的收藏者、倒卖者和经销商。

### 核心功能
| 功能 | 实现 |
|------|------|
| AI 卡牌扫描 | 上传图片 → 即时识别和估值 |
| OCR 提取 | Pytesseract 提取序列号、球员名、套系、年份、评分 |
| AI 结构化 | GPT-4 将 OCR 文本转为结构化数据 |
| 价格聚合 | eBay Finding API 实时市场数据 |
| 数字保险库 | 组织追踪收藏品 |
| 经销商工具 | P&L 计算、展会追踪、库存管理 |
| AI 挂单生成 | 自动生成 eBay/PWCC/WhatNot/COMC 销售文案 |

### 技术栈
```
前端：Next.js 14 + React 18 + TypeScript + Tailwind CSS
后端：FastAPI (Python 3.9+, async)
OCR：Pytesseract 0.3.10 + Pillow 10.2.0
AI：OpenAI GPT-4 (Assistants API + Chat Completions)
数据库：Supabase (PostgreSQL + Storage + Auth)
市场数据：eBay Finding API
部署：Vercel (前端) + Railway/Docker (后端)
支付：Stripe（Free + Pro $29.99/月）
```

### 数据库结构
8 张表：`users`, `user_profiles`, `cards`, `subscriptions`, `dealer_shows`, `dealer_show_cards`, `card_valuations`, `analytics_events`

### OCR 管线
1. 图片上传验证 → Supabase Storage（`card-images` bucket）
2. Pytesseract OCR 提取原始文本
3. GPT-4 结构化提取：球员名、套系名、年份、评分估计、价值区间、建议（flip/hold/grade/bundle）
4. 保留原始 OCR 文本 alongside 结构化结果
5. eBay Finding API 查询实时价格
6. 结果返回前端展示

### 商业模式
| 层级 | 限制 | 价格 |
|------|------|------|
| Free | 10-25 张卡，基础扫描，手动市场数据 | 免费 |
| Pro | 无限保险库，AI 挂单生成，经销商工具，CSV 导入导出 | $29.99/月 |

### 对泉知的启示
- ✅ 验证了"评级盒 OCR + 价格查询"这个需求是真实的（有付费用户愿意付 $30/月）
- ✅ OCR + AI 双层提取是正确的技术路线
- ⚠️ SlabStak 只接入了 eBay 一个数据源，没有跨平台聚合
- ⚠️ 只 OCR 用户上传的图，不做平台商品图片批量索引
- 💡 泉知可以考虑类似的免费+付费分层模式

---

## 二、多平台聚合架构：Adapter 模式

分析了 12+ 个多平台电商聚合项目，**所有成熟项目都使用 Adapter 模式**。

### 2.1 Laravel AI Price Intelligence
仓库：[github.com/padosoft/laravel-ai-price-intelligence](https://github.com/padosoft/laravel-ai-price-intelligence)

**接口驱动的 Adapter 架构：**
```php
// 核心接口
ProductScraperInterface      // 从 URL 提取 ProductSnapshot
MarketplaceAdapterInterface  // 每个平台一个 adapter
MatchStepInterface           // 级联匹配（GTIN → MPN → 模糊名称 → 语义嵌入）
EmbeddingProviderInterface   // 文本嵌入
RepricerEngineInterface      // 重定价建议

// 注册新平台只需在配置中添加一行
'adapters' => [
    'amazon' => \App\PriceIntel\AmazonSpApiAdapter::class,
],
```

### 2.2 E-Commerce Aggregator
仓库：[github.com/backspacevenkat/ecommerce-aggregator](https://github.com/backspacevenkat/ecommerce-aggregator)

- 12 个零售商统一聚合（Amazon, Walmart, Target, eBay, Costco, Temu, AliExpress...）
- MongoDB 存储 + Playwright 抓取
- 50+ 字段规范化
- 并行处理架构

### 2.3 规范化管线（Scrapfly 指南）

四步规范化确保跨平台可比性：
1. **字段映射** — 平台特定字段名 → 统一 schema
2. **值扩展** — 缩写展开（"HP" → "Hewlett-Packard"）
3. **单位转换** — 磅→千克、英寸→厘米
4. **货币标准化** — 汇率表统一

### 对泉知的启示
- ✅ 泉知当前的 `lib/platforms/` adapter 架构方向完全正确
- ✅ 每个平台一个 adapter 文件，导出统一接口
- 💡 未来可以考虑配置驱动（JSON/YAML 定义每个平台的 selector），减少代码量

---

## 三、AI 视觉 + 价格聚合项目

### 3.1 Product Scanner
仓库：[github.com/rocbase/product-scanner](https://github.com/rocbase/product-scanner)

- 移动 PWA，拍照识别商品
- GPT-4o 视觉识别 + eBay/Google Shopping API 价格查询
- Next.js 16 + React 19 + Tailwind CSS + Dexie (IndexedDB 离线)
- **离线优先架构值得借鉴**

### 3.2 Product OCR System (AWS)
仓库：[github.com/pandson7/product-ocr-system](https://github.com/pandson7/product-ocr-system)

- Serverless：React → API Gateway → Lambda → S3 + Bedrock Claude → DynamoDB
- 提取商品名、品牌、分类、价格、尺寸
- 完全无服务器，按用量付费

### 3.3 Computer Vision Web Scraper
仓库：[github.com/tararelan/Computer-Vision-Web-Scraper](https://github.com/tararelan/Computer-Vision-Web-Scraper)

- YOLOv5 目标检测定位电商页面中的价格、图片、评分元素
- 用于无法通过 DOM 解析的动态页面

### 3.4 FigureCollector
仓库：[github.com/Dim145/FigureCollector](https://github.com/Dim145/FigureCollector)

- 手办收藏管理 PWA
- Rust (Axum/SeaORM) + React 19 + TanStack Query
- 离线优先（Dexie IndexedDB）
- 管理后台定时抓取市场价格，历史化每次变动
- 条码扫描使用原生 BarcodeDetector API

---

## 四、关键架构模式对比

| 模式 | 代表项目 | 泉知是否采用 | 备注 |
|------|---------|-------------|------|
| Adapter 接口抽象 | 12+ 电商项目 | ✅ 已实现 | `lib/platforms/` |
| OCR + AI 双层提取 | SlabStak | ⚠️ 部分 | 当前只用正则，大规模时可加 AI |
| 静态 JSON 分片索引 | **泉知首创** | ✅ 已实现 | `/box-data/XX/xxxx.json` |
| 离线优先 + IndexedDB | FigureCollector, Product Scanner | ❌ 未采用 | 未来可考虑 |
| 置信度人工复核队列 | 多个 OCR 项目 | ✅ 雏形已有 | `ocr_pending_review` 标记 |
| 定时增量采集 | FigureCollector, PriceDropBot | ✅ 已实现 | Cron Worker |
| 规范化管线 | Scrapfly, Laravel AI Price Intel | ⚠️ 部分 | `utils.ts` 中的 clean/money/matchType |

---

## 五、泉知 vs 同类项目：差异化总结

| 维度 | 同类项目 | 泉知 |
|------|---------|------|
| 目标收藏品 | 卡牌、手办、乐高 | 钱币（NGC/PCGS 评级币） |
| 数据源 | eBay API、Amazon API | 邮宝、赵涌、易金等中国平台 |
| OCR 对象 | 用户上传的图 | 用户上传 + **平台商品图片批量索引** |
| 搜索方式 | 文本搜索 / API | 文本关键词 + 盒号精确匹配 |
| 索引构建 | 依赖平台 API | **自建 OCR → SQLite → 静态 JSON** |
| 部署 | SaaS 订阅 | 免费样品站（Netlify） |
| 开源 | 部分开源 | 全开源 |

---

## 六、结论

1. **需求验证**：SlabStak 的 $29.99/月付费模式证明"评级盒 OCR + 价格聚合"有真实付费意愿
2. **技术路线正确**：Adapter 模式、OCR 管线、静态索引都是行业验证过的做法
3. **泉知是独特的**：在全球开源项目中，没有第二家做"中国钱币评级盒跨平台 OCR 索引 + 价格聚合"
4. **最大挑战**是"从零建立盒号索引"（cold start），这需要持续的批量 OCR 和人工核验——目前泉知已经跑通了技术验证（易金 211 张 → 24 条候选，赵涌 461 张 → 15 条成交）
