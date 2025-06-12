import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * API配置
 */
export const API_CONFIG = {
  // Jupiter API
  JUPITER_PRICE_API: 'https://lite-api.jup.ag/price/v2',
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
  COINGECKO_COINS_LIST_API: process.env.COINGECKO_COINS_LIST_API || 'https://api.coingecko.com/api/v3/coins/list',
  COINGECKO_MARKETS_API: process.env.COINGECKO_MARKETS_API || 'https://api.coingecko.com/api/v3/coins/markets',
  
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
  ONEINCH_API: process.env.ONEINCH_API || 'https://api.1inch.io/v5.0',
  
  // Token Lists
  TOKEN_LISTS: {
    SOLANA: 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
    UNISWAP: 'https://gateway.ipfs.io/ipns/tokens.uniswap.org',
    SUSHISWAP: 'https://token-list.sushi.com'
  },
  
  // IPFS Gateway
  IPFS_GATEWAY: 'https://gateway.ipfs.io/ipfs/',
  
  // 区块链浏览器
  ETHERSCAN_URL: process.env.ETHERSCAN_URL || 'https://etherscan.io',
  SOLSCAN_URL: process.env.SOLSCAN_URL || 'https://solscan.io',
  BSCSCAN_URL: process.env.BSCSCAN_URL || 'https://bscscan.com',
  
  // 区块链 RPC
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // 区块链 API
  ETHERSCAN_API: process.env.ETHERSCAN_API || 'https://api.etherscan.io/api',
  SOLSCAN_API: process.env.SOLSCAN_API || 'https://public-api.solscan.io',
  
  // 其他 API
  FEAR_GREED_API: process.env.FEAR_GREED_API || 'https://api.alternative.me/fng/',
  
  // DeFi APIs
  UNISWAP_GRAPH_URL: process.env.UNISWAP_GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
};

/**
 * 常用代币地址
 */
export const TOKEN_ADDRESSES = {
  // Solana链上代币
  SOL: 'So11111111111111111111111111111111111111112', // WSOL
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  BTC: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC (Sollet)
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Portal)
};

/**
 * API Key配置
 */
export const API_KEYS = {
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY || '',
  CMC_API_KEY: process.env.CMC_API_KEY || '',
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
};

/**
 * 其他配置
 */
export const BOT_CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  DEFAULT_BASE_TOKEN: 'USDC',
  CACHE_EXPIRY: 5 * 60 * 1000, // 5分钟缓存过期
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'), // 默认缓存1小时
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

export default {
  API_CONFIG,
  TOKEN_ADDRESSES,
  API_KEYS,
  BOT_CONFIG
}; 