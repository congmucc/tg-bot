import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * API配置
 */
export const API_CONFIG = {
  // Jupiter API (Solana)
  JUPITER_PRICE_API: process.env.JUPITER_PRICE_API || 'https://lite-api.jup.ag/price/v2',
  JUPITER_TOKEN_LIST_API: process.env.JUPITER_TOKEN_LIST_API || 'https://token.jup.ag/all',
  JUPITER_SWAP_API: process.env.JUPITER_SWAP_API || 'https://quote-api.jup.ag/v6/quote',
  
  // Raydium API (Solana)
  RAYDIUM_API: process.env.RAYDIUM_API || 'https://api.raydium.io/v2/main/pairs',
  RAYDIUM_INFO_API: process.env.RAYDIUM_INFO_API || 'https://api.raydium.io/info/pairs',
  
  // CoinGecko API
  COINGECKO_API: process.env.COINGECKO_API || 'https://api.coingecko.com/api/v3',
  COINGECKO_PRICE_API: process.env.COINGECKO_PRICE_API || 'https://api.coingecko.com/api/v3/simple/price',
  COINGECKO_SEARCH_API: process.env.COINGECKO_SEARCH_API || 'https://api.coingecko.com/api/v3/search',
  COINGECKO_COINS_API: process.env.COINGECKO_COINS_API || 'https://api.coingecko.com/api/v3/coins',
  COINGECKO_COINS_LIST_API: process.env.COINGECKO_COINS_LIST_API || 'https://api.coingecko.com/api/v3/coins/list',
  COINGECKO_MARKETS_API: process.env.COINGECKO_MARKETS_API || 'https://api.coingecko.com/api/v3/coins/markets',
  
  // 中心化交易所 API
  BINANCE_API: process.env.BINANCE_API || 'https://api.binance.com/api/v3',
  BINANCE_TICKER_API: process.env.BINANCE_TICKER_API || 'https://api.binance.com/api/v3/ticker/price',
  OKX_API: process.env.OKX_API || 'https://www.okx.com/api/v5',
  OKX_TICKER_API: process.env.OKX_TICKER_API || 'https://www.okx.com/api/v5/market/ticker',
  COINBASE_API: process.env.COINBASE_API || 'https://api.coinbase.com/v2',
  COINBASE_PRICE_API: process.env.COINBASE_PRICE_API || 'https://api.coinbase.com/v2/prices',
  
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
  
  // 代币列表 API
  UNISWAP_TOKEN_LIST: process.env.UNISWAP_TOKEN_LIST || 'https://gateway.ipfs.io/ipns/tokens.uniswap.org',
  SUSHI_TOKEN_LIST: process.env.SUSHI_TOKEN_LIST || 'https://token-list.sushi.com',
  SOLANA_TOKEN_LIST: process.env.SOLANA_TOKEN_LIST || 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
  
  // DeFi APIs
  UNISWAP_GRAPH_URL: process.env.UNISWAP_GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  
  // 通用
  IPFS_GATEWAY: process.env.IPFS_GATEWAY || 'https://gateway.ipfs.io/ipfs',
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