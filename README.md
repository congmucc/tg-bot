# 🚀 加密货币分析助手 Telegram 机器人

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://telegram.org/)

一个功能强大的 Telegram 机器人，专为加密货币交易者和投资者设计，提供实时市场分析、多平台价格聚合、鲸鱼交易监控等专业功能。

## ✨ 核心功能

### 📊 价格分析与聚合
- **多平台价格聚合** - 同时查询 DEX、CEX 和聚合器价格，发现套利机会
- **实时价格查询** - 支持主流代币的实时价格获取
- **异常值检测** - 智能过滤异常价格，确保数据准确性
- **套利分析** - 自动计算不同平台间的价格差异

### 🐋 鲸鱼交易监控
- **多链支持** - 监控 ETH、SOL、BTC、Hyperliquid 大额交易
- **实时WebSocket** - 基于WebSocket的实时交易监控
- **智能过滤** - 可配置的监控阈值，避免噪音
- **详细信息** - 提供交易哈希、金额、地址等完整信息

### 🔄 流动性分析
- **流动性池查询** - 支持主流DEX的流动性池分析
- **TVL监控** - 实时总锁定价值监控
- **收益率计算** - 流动性挖矿收益率分析

### 📈 市场情绪
- **恐惧贪婪指数** - 实时市场情绪指标
- **定时报告** - 自动生成市场分析报告

## 🏗️ 项目架构

### 📁 目录结构
```
src/
├── 📂 api/                    # API 集成层
│   ├── 📂 aggregators/        # 价格聚合器
│   │   ├── jupiterAggregator.ts   # Jupiter DEX 聚合器
│   │   └── priceAggregator.ts     # 多平台价格聚合
│   ├── 📂 cex/               # 中心化交易所 API
│   │   ├── binanceApi.ts         # Binance API
│   │   ├── coinbaseApi.ts        # Coinbase API
│   │   ├── huobiApi.ts           # Huobi API
│   │   ├── okxApi.ts             # OKX API
│   │   └── index.ts              # CEX 统一接口
│   ├── 📂 dex/               # 去中心化交易所 API
│   │   ├── uniswap.ts            # Uniswap V3 API
│   │   ├── raydium.ts            # Raydium API
│   │   ├── oneinchApi.ts         # 1inch API
│   │   └── index.ts              # DEX 统一接口
│   ├── 📂 blockchain/        # 区块链 API
│   │   ├── ethereum.ts           # 以太坊链上数据
│   │   ├── solana.ts             # Solana 链上数据
│   │   ├── bitcoin.ts            # 比特币链上数据
│   │   ├── hyperliquidApi.ts     # Hyperliquid API
│   │   ├── websocketMonitor.ts   # WebSocket 监控
│   │   └── index.ts              # 区块链统一接口
│   └── 📂 interfaces/        # TypeScript 接口定义
├── 📂 bot/                    # Telegram 机器人
│   ├── 📂 commands/           # 命令处理器
│   │   ├── compare.ts            # 价格聚合命令
│   │   ├── price.ts              # 价格查询命令
│   │   ├── whale.ts              # 鲸鱼监控命令
│   │   └── index.ts              # 命令路由
│   ├── middleware.ts             # 中间件
│   └── index.ts                  # 机器人初始化
├── 📂 services/               # 业务逻辑层
│   ├── price.ts                  # 价格服务
│   ├── tokenResolver.ts          # 代币解析服务
│   ├── notification.ts           # 通知服务
│   └── whale.ts                  # 鲸鱼监控服务
├── 📂 utils/                  # 工具函数
│   ├── 📂 http/               # HTTP 客户端
│   │   └── httpClient.ts         # 统一 HTTP 客户端
│   └── 📂 crypto/             # 加密货币工具
├── 📂 config/                 # 配置管理
│   ├── env.ts                    # 环境变量
│   ├── tokens.ts                 # 代币配置
│   └── index.ts                  # 配置入口
├── 📂 test/                   # 测试文件
└── index.ts                      # 应用入口
```

### 🔧 技术架构

#### API 集成层
- **统一接口设计** - 所有交易所和区块链API都实现统一接口
- **错误处理** - 完善的错误处理和重试机制
- **超时控制** - 可配置的请求超时和重试策略
- **并发查询** - 支持并发查询多个数据源

#### 数据聚合层
- **价格聚合** - 从多个CEX、DEX和聚合器获取价格
- **异常值检测** - 智能过滤异常价格数据
- **套利分析** - 自动计算价格差异和套利机会

#### 监控系统
- **WebSocket监控** - 实时监控区块链交易
- **多链支持** - 支持以太坊、Solana、比特币等多条链
- **智能过滤** - 可配置的监控阈值和过滤规则

## 🚀 快速开始

### 📋 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0
- TypeScript >= 4.5.0

### 📦 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/yourusername/crypto-analysis-bot.git
cd crypto-analysis-bot
```

2. **安装依赖**
```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

3. **环境配置**

创建 `.env` 文件并配置以下变量：

```env
# Telegram 机器人配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# API 配置 (可选)
COINGECKO_API_KEY=your_coingecko_api_key
ALCHEMY_API_KEY=your_alchemy_api_key
HELIUS_API_KEY=your_helius_api_key

# 监控配置
WHALE_MONITOR_ENABLED=true
WHALE_THRESHOLD_ETH=10
WHALE_THRESHOLD_SOL=1000
WHALE_THRESHOLD_BTC=1

# 服务器配置
PORT=3000
NODE_ENV=production
```

4. **启动应用**

```bash
# 开发模式
npm run dev
# 或
yarn dev

# 生产模式
npm run build && npm start
# 或
yarn build && yarn start
```

### 🔧 配置说明

| 配置项 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `TELEGRAM_BOT_TOKEN` | Telegram 机器人令牌 | ✅ | - |
| `TELEGRAM_CHAT_ID` | Telegram 聊天ID | ✅ | - |
| `WHALE_THRESHOLD_ETH` | ETH 鲸鱼监控阈值 | ❌ | 10 |
| `WHALE_THRESHOLD_SOL` | SOL 鲸鱼监控阈值 | ❌ | 1000 |
| `WHALE_THRESHOLD_BTC` | BTC 鲸鱼监控阈值 | ❌ | 1 |
| `PORT` | HTTP 服务器端口 | ❌ | 3000 |

## 📱 使用指南

### 🤖 Telegram 命令

| 命令 | 功能 | 示例 | 说明 |
|------|------|------|------|
| `/start` | 启动机器人 | `/start` | 显示主菜单和功能介绍 |
| `/price [代币]` | 价格查询 | `/price BTC` | 查询单个代币的实时价格 |
| `/compare [代币]` | 价格聚合 | `/compare ETH` | 多平台价格对比和套利分析 |
| `/whale [阈值]` | 鲸鱼监控 | `/whale 10` | 监控大额交易，支持多链 |
| `/fear` | 市场情绪 | `/fear` | 查看恐惧贪婪指数 |
| `/trend [代币] [时间]` | 趋势分析 | `/trend BTC 7d` | 价格趋势和技术分析 |
| `/track [链] [地址]` | 钱包跟踪 | `/track eth 0x...` | 跟踪钱包资产变化 |
| `/help` | 帮助信息 | `/help` | 显示所有可用命令 |

### 🚀 高级交易系统

| 命令 | 功能 | 示例 | 说明 |
|------|------|------|------|
| `/trade [买/卖] [代币对] [数量]` | 智能市价单 | `/trade 买 ETH/USDC 0.5` | MEV保护的智能交易 |
| `/trade limit [代币对] [价格] [数量]` | 限价单 | `/trade limit ETH/USDC 2500 0.5` | 设置目标价格交易 |
| `/trade stop [代币对] [止损价] [数量]` | 止损单 | `/trade stop ETH/USDC 2300 0.5` | 风险控制止损 |
| `/trade dca [代币对] [金额] [周期]` | DCA定投 | `/trade dca BTC/USDC 1000 7d` | 定期投资策略 |
| `/trade twap [代币对] [金额] [批次] [间隔]` | TWAP分批 | `/trade twap ETH/USDC 500 5 30m` | 时间加权平均价格 |
| `/trade analyze [代币对] [数量]` | 交易分析 | `/trade analyze ETH/USDC 1` | 深度交易分析 |
| `/trade route [代币对] [金额]` | 路由分析 | `/trade route ETH/USDC 1000` | 最优路由分析 |
| `/trade mev [代币对] [金额]` | MEV分析 | `/trade mev ETH/USDC 1` | MEV风险评估 |
| `/trade tech [技术类型]` | 技术展示 | `/trade tech clmm` | DeFi前沿技术展示 |
| `/trade defi` | 生态系统 | `/trade defi` | 完整DeFi技术栈 |

### 🔔 钱包跟踪系统

| 命令 | 功能 | 示例 | 说明 |
|------|------|------|------|
| `/track eth [地址] [名称]` | 添加ETH钱包 | `/track eth 0x742d... Vitalik` | 跟踪以太坊钱包资产 |
| `/track sol [地址] [名称]` | 添加SOL钱包 | `/track sol 9WzDX... 大户` | 跟踪Solana钱包资产 |
| `/track list` | 钱包列表 | `/track list` | 查看所有跟踪钱包 |
| `/track view [ID]` | 钱包详情 | `/track view ABC123` | 查看钱包详细信息 |
| `/track delete [ID]` | 删除钱包 | `/track delete ABC123` | 删除特定钱包 |

## 🚀 高级交易功能详解

### 🛡️ MEV保护机制
我们的交易系统集成了先进的MEV（最大可提取价值）保护机制：

- **🔒 私有内存池**: 高风险交易自动使用私有内存池，防止抢跑攻击
- **⚡ 智能Gas优化**: 动态调整Gas费用，在速度和成本间找到最佳平衡
- **⏰ 时间延迟执行**: 通过时间延迟避免三明治攻击
- **🔄 分批交易**: 大额交易自动分批执行，降低价格冲击

### 🗺️ 智能路由系统
多DEX聚合路由，确保最优交易执行：

- **📊 流动性分析**: 实时分析各DEX流动性深度
- **💰 价格影响计算**: 精确计算交易对价格的影响
- **⛽ Gas费用优化**: 平衡执行效率和交易成本
- **🎯 最优路径**: 自动选择最佳交易路径组合

### 📈 高级交易策略

#### DCA定投策略
```bash
/trade dca BTC/USDC 1000 7d    # 每7天投资，总额1000 USDC
/trade dca ETH/USDC 500 1w     # 每周投资，总额500 USDC
```
- 降低市场波动影响
- 平均购买成本
- 减少情绪化交易

#### TWAP分批交易
```bash
/trade twap ETH/USDC 1000 5 30m    # 1000 USDC分5批，每30分钟执行一次
/trade twap BTC/USDC 2000 10 1h    # 2000 USDC分10批，每小时执行一次
```
- 时间加权平均价格
- 减少滑点损失
- 避免MEV攻击

#### 止损保护
```bash
/trade stop ETH/USDC 2300 0.5     # ETH价格跌破2300时卖出0.5个
/trade stop BTC/USDC 45000 0.1    # BTC价格跌破45000时卖出0.1个
```
- 智能风险控制
- 自动执行止损
- 保护投资本金

### 🔍 深度分析工具

#### 交易前分析
```bash
/trade analyze ETH/USDC 1      # 分析1个ETH的交易
```
提供详细的交易分析报告：
- 最优路由分配
- MEV风险评估
- Gas费用预估
- 价格影响分析

#### 路由优化分析
```bash
/trade route ETH/USDC 1000     # 分析1000 USDC的最优路由
```
显示智能路由策略：
- 各DEX分配比例
- 流动性深度对比
- 价格影响评估
- Gas费用分解

#### MEV风险评估
```bash
/trade mev ETH/USDC 5          # 评估5个ETH交易的MEV风险
```
全面的MEV风险分析：
- 抢跑攻击概率
- 三明治攻击风险
- 保护策略建议
- 风险等级评分

### 🎯 系统特色

#### **🤖 智能交易系统**
- **MEV保护**: 集成Flashbots、CoW Protocol等前沿MEV保护技术
- **智能路由**: 支持15+主流DEX的最优路由分配算法
- **意图驱动**: 实现声明式交易，用户只需表达交易意图
- **跨链聚合**: 支持以太坊、Solana、Arbitrum等多链交易

#### **🔍 实时监控系统**
- **WebSocket监控**: 实时监控ETH、SOL、BTC、Hyperliquid大额交易
- **钱包跟踪**: 支持多链钱包资产实时跟踪和余额查询
- **价格聚合**: 整合10+交易所和DEX的实时价格数据
- **技术分析**: 集成恐惧贪婪指数、趋势分析等技术指标

#### **🚀 前沿技术展示**
- **CLMM技术**: 展示Uniswap V3集中流动性做市机制
- **Intent-Centric**: 演示意图驱动架构的交易执行
- **Cross-Chain**: 实现THORChain等跨链原生交易技术
- **DeFi生态**: 完整的DeFi技术栈知识展示

### 💡 使用技巧

#### 价格查询 (`/price`)
```
/price BTC          # 查询比特币价格
/price ETH          # 查询以太坊价格
/price SOL          # 查询Solana价格
```

#### 价格聚合 (`/compare`)
```
/compare ETH        # ETH多平台价格对比
/compare BTC USDT   # BTC/USDT交易对价格聚合
/compare SOL        # SOL价格聚合分析
```

**功能特点：**
- 🔄 同时查询 6-8 个价格源
- 📊 包含 CEX、DEX、聚合器价格
- 🎯 智能异常值检测
- 💰 自动套利机会分析

#### 鲸鱼监控 (`/whale`)
```
/whale              # 使用默认阈值监控
/whale 5            # 监控5 ETH以上的交易
/whale 1000 SOL     # 监控1000 SOL以上的交易
```

**支持的区块链：**
- 🔷 **Ethereum** - 监控ETH和ERC-20代币转账
- 🟣 **Solana** - 监控SOL和SPL代币转账
- 🟠 **Bitcoin** - 监控BTC链上大额转账
- ⚡ **Hyperliquid** - 监控合约交易和转账

## 🆕 最新更新

### 比特币支持
- ✅ 新增比特币大额交易监控
- ✅ 支持BTC链上交易查询
- ✅ 集成Blockstream API
- ✅ 完整的测试覆盖

### 代码优化
- ✅ 移除冗余代码和未使用的导入
- ✅ 统一格式化函数
- ✅ 优化错误处理机制
- ✅ 提升性能和稳定性

### 测试完善
- ✅ 新增Bitcoin API测试
- ✅ 鲸鱼监控服务测试
- ✅ 区块链集成测试
- ✅ 所有测试通过 (22/22)

## 🛠️ 技术栈

### 核心技术
| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | >=16.0 | 运行时环境 |
| **TypeScript** | >=4.5 | 编程语言 |
| **Telegraf** | ^4.12 | Telegram 机器人框架 |
| **Axios** | ^1.4 | HTTP 客户端 |
| **Ethers.js** | ^5.7 | 以太坊区块链交互 |
| **@solana/web3.js** | ^1.78 | Solana 区块链交互 |
| **ws** | ^8.13 | WebSocket 客户端 |

### 开发工具
- **ts-node-dev** - 开发环境热重载
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Jest** - 单元测试框架

## 🏪 支持的交易平台

### 🏦 中心化交易所 (CEX)
| 交易所 | 状态 | API版本 | 支持交易对 |
|--------|------|---------|------------|
| **Binance** | ✅ | v3 | BTC/USDT, ETH/USDT, SOL/USDT |
| **Coinbase** | ✅ | v2 | BTC/USD, ETH/USD, SOL/USD |
| **OKX** | ✅ | v5 | BTC/USDT, ETH/USDT, SOL/USDT |
| **Huobi** | ✅ | v1 | BTC/USDT, ETH/USDT |

### 🔄 去中心化交易所 (DEX)
| DEX | 区块链 | 状态 | 支持功能 |
|-----|--------|------|----------|
| **Uniswap V3** | Ethereum | ✅ | 价格查询、流动性分析 |
| **Raydium** | Solana | ✅ | 价格查询、AMM池 |
| **1inch** | Multi-chain | ✅ | 聚合交易、价格查询 |

### 📊 价格聚合器
| 聚合器 | 状态 | 数据源 | 更新频率 |
|--------|------|--------|----------|
| **CoinGecko** | ✅ | 500+ 交易所 | 实时 |
| **CryptoCompare** | ✅ | 200+ 交易所 | 实时 |
| **CoinCap** | ✅ | 100+ 交易所 | 实时 |
| **Jupiter** | ✅ | Solana DEX | 实时 |

### ⛓️ 区块链网络
| 网络 | 状态 | 监控功能 | RPC提供商 |
|------|------|----------|-----------|
| **Ethereum** | ✅ | 交易监控、价格查询 | Alchemy |
| **Solana** | ✅ | 交易监控、价格查询 | Helius |
| **Bitcoin** | ✅ | 交易监控 | Blockstream |
| **Hyperliquid** | ✅ | 合约监控 | 官方API |

## 📈 性能特点

### 🚀 高性能设计
- **并发查询** - 同时查询多个API，提高响应速度
- **智能缓存** - 减少重复请求，提升用户体验
- **异常处理** - 完善的错误处理和重试机制
- **超时控制** - 可配置的请求超时，避免长时间等待

### 📊 数据准确性
- **异常值检测** - 自动过滤异常价格数据
- **多源验证** - 通过多个数据源交叉验证
- **实时更新** - WebSocket连接确保数据实时性
- **精度保证** - 高精度数值计算，避免精度丢失

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "Bitcoin"

# 生成测试覆盖率报告
npm run test:coverage
```

### 测试覆盖
- ✅ **API集成测试** - 所有交易所和区块链API
- ✅ **价格聚合测试** - 多平台价格聚合逻辑
- ✅ **鲸鱼监控测试** - 交易监控和过滤逻辑
- ✅ **错误处理测试** - 各种异常情况处理
- ✅ **端到端测试** - 完整的用户交互流程

## 🚀 部署

### Docker 部署
```bash
# 构建镜像
docker build -t crypto-bot .

# 运行容器
docker run -d \
  --name crypto-bot \
  --env-file .env \
  -p 3000:3000 \
  crypto-bot
```

### PM2 部署
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs crypto-bot
```

### 云服务部署
支持部署到以下平台：
- **Heroku** - 一键部署
- **Vercel** - Serverless部署
- **AWS EC2** - 传统服务器部署
- **DigitalOcean** - VPS部署

## 🤝 贡献指南

### 开发流程
1. **Fork 项目** - 点击右上角 Fork 按钮
2. **克隆仓库** - `git clone https://github.com/yourusername/crypto-analysis-bot.git`
3. **创建分支** - `git checkout -b feature/amazing-feature`
4. **开发功能** - 编写代码并添加测试
5. **运行测试** - `npm test` 确保所有测试通过
6. **提交代码** - `git commit -m 'Add some amazing feature'`
7. **推送分支** - `git push origin feature/amazing-feature`
8. **创建PR** - 在GitHub上创建Pull Request

### 代码规范
- 使用 **TypeScript** 编写所有代码
- 遵循 **ESLint** 和 **Prettier** 规范
- 为新功能添加 **单元测试**
- 更新相关 **文档**

### 贡献领域
- 🔌 **新API集成** - 添加更多交易所或区块链支持
- 📊 **数据分析** - 改进价格分析和套利检测算法
- 🎨 **用户界面** - 优化Telegram机器人交互体验
- 🧪 **测试覆盖** - 增加测试用例和覆盖率
- 📚 **文档完善** - 改进文档和使用指南

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢以下开源项目和服务提供商：
- [Telegraf.js](https://telegraf.js.org/) - Telegram Bot框架
- [Ethers.js](https://ethers.org/) - 以太坊JavaScript库
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - Solana JavaScript SDK
- [CoinGecko](https://www.coingecko.com/) - 加密货币数据API
- [Jupiter](https://jup.ag/) - Solana聚合器
- 所有贡献者和用户的支持

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个星标！**

[🐛 报告Bug](https://github.com/yourusername/crypto-analysis-bot/issues) • [💡 功能建议](https://github.com/yourusername/crypto-analysis-bot/issues) • [📖 文档](https://github.com/yourusername/crypto-analysis-bot/wiki)

</div>