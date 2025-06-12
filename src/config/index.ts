import dotenv from 'dotenv';
dotenv.config();

// 环境变量类型声明
export interface EnvConfig {
  // Telegram配置
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  
  // 以太坊API配置
  ETHEREUM_RPC_URL: string;
  ETHERSCAN_API_KEY: string;
  
  // Solana API配置
  SOLANA_RPC_URL: string;
  SOLSCAN_API_KEY: string;
  
  // DEX API配置
  UNISWAP_GRAPH_URL: string;
  RAYDIUM_API_URL: string;
  
  // Web3存储配置
  IPFS_GATEWAY: string;
  
  // 价格API配置
  CMC_API_KEY: string;

  // Jupiter API URLs
  JUPITER_API_URL: string;
  JUPITER_TOKEN_LIST_URL: string;

  // 其他配置
  COINGECKO_API_URL: string;
  SOLANA_TOKEN_LIST_URL: string;

  // 缓存配置
  CACHE_TTL: number;

  // 日志级别
  LOG_LEVEL: string;
}

// DEX 配置
export interface DexConfig {
  name: string;
  chainId: number;
  factoryAddress: string;
  routerAddress: string;
  baseTokens: string[];
}

// 从环境变量获取配置
export const config: EnvConfig = {
  // Telegram配置
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // 以太坊API配置
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  
  // Solana API配置
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY || '',
  
  // DEX API配置
  UNISWAP_GRAPH_URL: process.env.UNISWAP_GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  RAYDIUM_API_URL: process.env.RAYDIUM_API_URL || 'https://api.raydium.io/v2/main',
  
  // Web3存储配置
  IPFS_GATEWAY: process.env.IPFS_GATEWAY || 'https://gateway.ipfs.io/ipfs',
  
  // 价格API配置
  CMC_API_KEY: process.env.CMC_API_KEY || '',

  // Jupiter API URLs
  JUPITER_API_URL: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
  JUPITER_TOKEN_LIST_URL: process.env.JUPITER_TOKEN_LIST_URL || 'https://token.jup.ag/all',

  // 其他配置
  COINGECKO_API_URL: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
  SOLANA_TOKEN_LIST_URL: process.env.SOLANA_TOKEN_LIST_URL || 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
  
  // 缓存配置
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'), // 默认缓存1小时
  
  // 日志级别
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// DEX 配置信息
export const dexConfigs: Record<string, DexConfig> = {
  UNISWAP_V2: {
    name: 'Uniswap V2',
    chainId: 1, // Ethereum
    factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    baseTokens: [
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    ],
  },
  PANCAKESWAP: {
    name: 'PancakeSwap',
    chainId: 56, // BSC
    factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    baseTokens: [
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      '0x55d398326f99059fF775485246999027B3197955', // USDT
      '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
    ],
  },
};

export default {
  config,
  dexConfigs,
}; 