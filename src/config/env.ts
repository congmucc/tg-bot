/**
 * 环境变量配置
 * 这个文件用于管理应用程序的环境变量和配置
 */

import 'dotenv/config';

/**
 * API配置
 */
export const API_CONFIG = {
  // Jupiter API
  JUPITER_PRICE_API: 'https://price.jup.ag/v4/price',
  JUPITER_TOKEN_LIST_API: 'https://token.jup.ag/all',
  JUPITER_SWAP_API: 'https://quote-api.jup.ag/v6/quote',
  
  // Raydium API
  RAYDIUM_API: 'https://api.raydium.io/v2/main/pairs',
  RAYDIUM_INFO_API: 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json',
  
  // CoinGecko API
  COINGECKO_API: 'https://api.coingecko.com/api/v3',
  COINGECKO_PRICE_API: 'https://api.coingecko.com/api/v3/simple/price',
  COINGECKO_SEARCH_API: 'https://api.coingecko.com/api/v3/search',
  COINGECKO_COINS_API: 'https://api.coingecko.com/api/v3/coins',
  COINGECKO_COINS_LIST_API: 'https://api.coingecko.com/api/v3/coins/list',
  COINGECKO_MARKETS_API: 'https://api.coingecko.com/api/v3/coins/markets',
  
  // 中心化交易所 API
  BINANCE_API_BASE_URL: 'https://api.binance.com',
  BINANCE_TICKER_API: 'https://api.binance.com/api/v3/ticker/price',
  OKX_API_BASE_URL: 'https://www.okx.com',
  OKX_TICKER_API: 'https://www.okx.com/api/v5/market/ticker',
  COINBASE_API_BASE_URL: 'https://api.coinbase.com',
  COINBASE_PRICE_API: 'https://api.coinbase.com/v2/prices',
  KRAKEN_API_BASE_URL: 'https://api.kraken.com',
  HUOBI_API_BASE_URL: 'https://api.huobi.pro',
  
  // DEX API
  UNISWAP_API: 'https://api.uniswap.org/v1',
  
  // 聚合器 API
  ONEINCH_API: 'https://api.1inch.io/v5.0',
  
  // Token Lists
  TOKEN_LISTS: {
    SOLANA: 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
    UNISWAP: 'https://gateway.ipfs.io/ipns/tokens.uniswap.org',
    SUSHISWAP: 'https://token-list.sushi.com'
  },
  
  // IPFS Gateway
  IPFS_GATEWAY: 'https://gateway.ipfs.io/ipfs/',
  
  // 区块链浏览器
  ETHERSCAN_URL: 'https://etherscan.io',
  SOLSCAN_URL: 'https://solscan.io',
  BSCSCAN_URL: 'https://bscscan.com',
  
  // 区块链 RPC - 使用免费的公开端点
  ETHEREUM_RPC_URL: 'https://eth.llamarpc.com',
  ETHEREUM_WS_URL: 'wss://eth.llamarpc.com',
  SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
  SOLANA_WS_URL: 'wss://api.mainnet-beta.solana.com',

  // Hyperliquid API
  HYPERLIQUID_API_URL: 'https://api.hyperliquid.xyz',
  HYPERLIQUID_WS_URL: 'wss://api.hyperliquid.xyz/ws',
  
  // 区块链 API
  ETHERSCAN_API: 'https://api.etherscan.io/api',
  SOLSCAN_API: 'https://public-api.solscan.io',
  
  // 其他 API
  FEAR_GREED_API: 'https://api.alternative.me/fng/'
};

/**
 * API Key配置 - 保留必要的scan API用于交易详情查询
 */
export const API_KEYS = {
  // 可选的scan API密钥，用于获取交易详情
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY || '',
};

/**
 * 机器人配置
 */
export const BOT_CONFIG = {
  // Telegram配置
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // 大额交易监控配置
  WHALE_MONITOR_ENABLED: process.env.WHALE_MONITOR_ENABLED !== 'false', // 默认启用
  WHALE_MONITOR_INTERVAL: parseInt(process.env.WHALE_MONITOR_INTERVAL || '15'), // 默认15秒
  WHALE_MONITOR_COOLDOWN: parseInt(process.env.WHALE_MONITOR_COOLDOWN || '5'), // 默认5秒冷却
  WHALE_MONITOR_BATCH_SIZE: parseInt(process.env.WHALE_MONITOR_BATCH_SIZE || '5'), // 每次最多发送5条
  
  // HTTP服务器配置
  PORT: parseInt(process.env.PORT || '3001'),
  
  // 日志配置
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // 数据库配置
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // 缓存配置
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600') // 默认1小时
};

/**
 * 其他配置
 */
export const OTHER_CONFIG = {
  // 价格警报配置
  PRICE_ALERT_INTERVAL: parseInt(process.env.PRICE_ALERT_INTERVAL || '3600'), // 默认1小时
  PRICE_CHANGE_THRESHOLD: parseFloat(process.env.PRICE_CHANGE_THRESHOLD || '5'), // 默认5%
  
  // 交易配置
  SLIPPAGE_TOLERANCE: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5'), // 默认0.5%
  GAS_MULTIPLIER: parseFloat(process.env.GAS_MULTIPLIER || '1.1'), // 默认1.1x
  
  // 安全配置
  MAX_GAS_LIMIT: parseInt(process.env.MAX_GAS_LIMIT || '500000'), // 最大gas限制
  MAX_PRIORITY_FEE: parseInt(process.env.MAX_PRIORITY_FEE || '3'), // 最大优先费(gwei)
  
  // 其他配置
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY || 'USD'
};

export default {
  API_CONFIG,
  API_KEYS,
  BOT_CONFIG,
  OTHER_CONFIG
}; 