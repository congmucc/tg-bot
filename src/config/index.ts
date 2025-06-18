import dotenv from 'dotenv';
dotenv.config();

// 环境变量类型声明
export interface EnvConfig {
  // Telegram配置 (必需)
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;

  // 鲸鱼监控配置
  WHALE_MONITOR_ENABLED: boolean;
  WHALE_MONITOR_INTERVAL: number;
  WHALE_MONITOR_COOLDOWN: number;
  WHALE_MONITOR_BATCH_SIZE: number;

  // 服务器配置
  PORT: number;
  LOG_LEVEL: string;
  CACHE_TTL: number;

  // 可选API密钥
  ETHERSCAN_API_KEY: string;
  SOLSCAN_API_KEY: string;
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
  // Telegram配置 (必需)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',

  // 鲸鱼监控配置
  WHALE_MONITOR_ENABLED: process.env.WHALE_MONITOR_ENABLED === 'true',
  WHALE_MONITOR_INTERVAL: parseInt(process.env.WHALE_MONITOR_INTERVAL || '15'),
  WHALE_MONITOR_COOLDOWN: parseInt(process.env.WHALE_MONITOR_COOLDOWN || '5'),
  WHALE_MONITOR_BATCH_SIZE: parseInt(process.env.WHALE_MONITOR_BATCH_SIZE || '5'),

  // 服务器配置
  PORT: parseInt(process.env.PORT || '3000'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'),

  // 可选API密钥
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY || '',
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