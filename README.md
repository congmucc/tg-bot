# 加密货币 DEX 分析机器人

这个 Telegram 机器人为加密货币投资者提供全面的 DEX 和区块链分析功能，可以帮助用户监控市场、跟踪钱包、发现交易机会，以及获取市场情绪指标。

## 功能特点

### 价格与市场分析
- `/price [代币符号]` - 查询代币实时价格、交易量和市值
- `/compare [代币符号]` - 比较不同 DEX 之间的代币价格差异
- `/fear` - 显示当前市场恐惧贪婪指数与历史趋势


### 交易功能
- `/trade [代币符号]` - 获取基于技术分析的智能交易建议
- `/arbitrage [代币对]` - 发现跨 DEX 套利机会
- `/trend [代币符号] [天数]` - 提供市场趋势预测和关键支撑阻力位

### 流动性分析
- `/liquidity [池地址/代币对] [链]` - 分析流动性池参数和不稳定损失

### 链上监控
- `/whale [金额]` - 监控以太坊和 Solana 网络上的大额转账
- `/solana` - 查看 Solana 网络状态和主要指标
- `/alert [代币符号] [条件] [价格]` - 设置价格提醒
- `/track [链] [地址] [名称]` - 跟踪特定钱包的资产和交易

## 支持的区块链和 DEX

### 区块链
- 以太坊 (Ethereum)
- Solana

### DEX
- Uniswap (以太坊)
- Raydium (Solana)

## 安装与设置

### 前提条件
- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器
- Telegram 机器人 Token

### 安装步骤
1. 克隆代码库
   ```bash
   git clone https://github.com/yourusername/crypto-dex-bot.git
   cd crypto-dex-bot
   ```

2. 安装依赖
   ```bash
   npm install
   ```
   或
   ```bash
   yarn install
   ```

3. 配置环境变量
   - 复制 `.env.example` 到 `.env`
   - 填入你的 Telegram 机器人 Token 和其他 API 密钥

4. 编译 TypeScript 代码
   ```bash
   npm run build
   ```

5. 启动机器人
   ```bash
   npm start
   ```

## 环境变量配置

创建 `.env` 文件并添加以下配置:

```
# Telegram配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# 以太坊API配置
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Solana API配置
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLSCAN_API_KEY=your_solscan_api_key_here

# DEX API配置
UNISWAP_GRAPH_URL=https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3
RAYDIUM_API_URL=https://api.raydium.io/v2
```

## 项目结构

```
src/
├── api/                  # API 接口
│   ├── blockchain/       # 区块链 API (以太坊, Solana)
│   └── dex/              # DEX API (Uniswap, Raydium)
├── bot/                  # Telegram 机器人
│   ├── commands/         # 命令处理器
│   └── middleware/       # 中间件
├── config/               # 配置文件
├── services/             # 业务逻辑
└── utils/                # 工具函数
```

## 使用示例

1. 查询 BTC 价格:
   ```
   /price btc
   ```

2. 比较不同 DEX 上的 ETH 价格:
   ```
   /compare eth
   ```

3. 查找 ETH/USDC 交易对的套利机会:
   ```
   /arbitrage eth usdc
   ```

4. 跟踪以太坊钱包:
   ```
   /track eth 0x1234... 我的钱包
   ```

5. 设置价格提醒:
   ```
   /alert BTC > 50000
   ```

## 贡献指南

欢迎贡献代码、提交问题或功能建议。请遵循以下步骤:

1. Fork 代码库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。