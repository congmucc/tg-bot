# 加密货币分析助手 Telegram 机器人

一个功能强大的 Telegram 机器人，用于加密货币市场分析、价格查询和交易机会监控。

## 功能特点

- 市场情绪分析（恐惧贪婪指数）
- 代币价格查询（支持多种交易所）

- 交易平台价格聚合（DEX + CEX）
- 流动性池分析
- 大额转账监控（鲸鱼警报）- **新增比特币支持！**
- 定时市场报告

## 项目结构

```
src/
├── api/                # API 相关模块
│   ├── aggregators/    # 价格聚合器
│   │   ├── index.ts
│   │   ├── jupiterAggregator.ts   # Jupiter聚合器
│   │   └── priceAggregator.ts
│   ├── cex/            # 中心化交易所 API
│   │   ├── binanceApi.ts
│   │   ├── coinbaseApi.ts
│   │   ├── huobiApi.ts
│   │   ├── index.ts
│   │   ├── krakenApi.ts
│   │   └── okxApi.ts
│   ├── dex/            # 去中心化交易所 API
│   │   ├── index.ts
│   │   ├── pancakeswapApi.ts
│   │   ├── raydium.ts
│   │   ├── syncswapApi.ts
│   │   └── uniswap.ts
│   ├── blockchain/     # 区块链 API
│   │   ├── ethereum.ts     # 以太坊 API
│   │   ├── solana.ts       # Solana API
│   │   ├── bitcoin.ts      # 比特币 API (新增)
│   │   ├── hyperliquidApi.ts # Hyperliquid API
│   │   └── index.ts        # 区块链 API 统一接口
│   ├── interfaces/     # API 接口定义
│   │   └── exchangeApi.ts
│   └── index.ts        # API 模块入口
├── bot/                # 机器人核心模块
│   ├── commands/       # 命令处理器
│   ├── middleware.ts   # 中间件
│   └── index.ts        # 机器人初始化
├── config/             # 配置文件
│   └── env.ts          # 环境变量配置
├── services/           # 业务逻辑服务
│   ├── price.ts        # 价格服务
│   ├── tokenResolver.ts # 代币解析服务
│   ├── liquidity.ts    # 流动性分析服务
│   ├── notification.ts # 通知服务
│   ├── trading.ts      # 交易服务
│   └── whale.ts        # 大额交易监控服务
├── utils/              # 工具函数
│   └── http/           # HTTP 客户端
├── test/               # 测试文件
└── index.ts            # 应用入口
```

## 安装与设置

1. 克隆仓库
```bash
git clone https://github.com/yourusername/crypto-analysis-bot.git
cd crypto-analysis-bot
```

2. 安装依赖
```bash
npm install
```

3. 创建 .env 文件并配置以下变量
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

4. 启动机器人
```bash
npm start
```

## 可用命令

- `/start` - 启动机器人并显示主菜单
- `/fear` - 查看恐惧贪婪指数
- `/price [代币符号]` - 查询代币价格
- `/solana` - 查看 Solana 网络状态
- `/compare [代币符号]` - 交易平台价格聚合(DEX+CEX)
- `/liquidity [LP地址] [链]` - 查询流动性池
- `/whale [数量]` - 监控大额转账 (支持ETH/SOL/BTC/Hyperliquid)
- `/help` - 显示帮助信息

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

## 技术栈

- Node.js
- TypeScript
- Telegraf.js (Telegram Bot API)
- 各种 DEX/CEX API
- Jupiter API (Solana)
- Blockstream API (Bitcoin)
- Hyperliquid API

## 贡献指南

1. Fork 该项目
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

MIT License