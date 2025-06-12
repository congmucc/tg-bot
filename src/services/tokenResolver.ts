import axios from 'axios';
import { tokens, getTokenBySymbol } from '../config/tokens';

// 缓存已解析的代币，减少API调用
const tokenCache: Record<string, any> = {};
let tokenListsCache: any = null;
let lastTokenListFetch: number = 0;

interface TokenInfo {
  name: string;
  symbol: string;
  address?: string;
  decimals?: number;
  chainId?: number;
  logoURI?: string;
  source: string; // 标识来源: "config", "coingecko", "tokenlist"
  id?: string;    // CoinGecko ID
  wrappedVersion?: TokenInfo; // 对于derived_unwrapped类型，引用其包装版本
}

/**
 * 从CoinGecko获取代币信息
 * @param symbol 代币符号
 * @returns 代币信息或null
 */
async function getFromCoinGecko(symbol: string): Promise<TokenInfo | null> {
  try {
    // 使用CoinGecko搜索API
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`
    );
    
    if (searchResponse.data && 
        searchResponse.data.coins && 
        searchResponse.data.coins.length > 0) {
      
      // 尝试找到精确匹配
      const exactMatch = searchResponse.data.coins.find(
        (coin: any) => coin.symbol.toUpperCase() === symbol
      );
      
      const bestMatch = exactMatch || searchResponse.data.coins[0];
      
      // 获取更多代币细节
      const coinResponse = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${bestMatch.id}`
      );
      
      if (coinResponse.data) {
        const coin = coinResponse.data;
        return {
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          decimals: 18, // CoinGecko默认不提供精度
          source: 'coingecko',
          id: coin.id,
          logoURI: coin.image?.large
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('CoinGecko查询失败:', error);
    return null;
  }
}

/**
 * 动态解析代币信息
 * @param input 代币符号或地址
 * @returns 代币信息或null
 */
export async function resolveToken(input: string): Promise<TokenInfo | null> {
  input = input.trim().toUpperCase();
  
  // 1. 检查缓存
  if (tokenCache[input]) {
    return tokenCache[input];
  }
  
  // 2. 尝试从CoinGecko获取信息（优先）
  try {
    const coingeckoToken = await getFromCoinGecko(input);
    if (coingeckoToken) {
      console.log(`从CoinGecko获取代币信息: ${input}`);
      // 缓存结果
      tokenCache[input] = coingeckoToken;
      return coingeckoToken;
    }
  } catch (error) {
    console.error(`从CoinGecko获取 ${input} 失败:`, error);
  }
  
  // 3. 检查配置文件中的代币
  let configToken = getTokenBySymbol(input, 'ethereum');
  if (!configToken) {
    configToken = getTokenBySymbol(input, 'solana');
  }
  
  if (configToken) {
    console.log(`从配置获取代币信息: ${input}`);
    const tokenInfo: TokenInfo = {
      name: configToken.name,
      symbol: configToken.symbol,
      address: configToken.address,
      decimals: configToken.decimals,
      source: 'config'
    };
    
    // 缓存结果
    tokenCache[input] = tokenInfo;
    return tokenInfo;
  }
  
  // 4. 处理特殊情况 - 包装代币
  const wrappedMapping: Record<string, string> = {
    'SOL': 'WSOL',
    'BTC': 'WBTC',
    'ETH': 'WETH'
  };
  
  // 如果查询的是包装代币的原始代币，尝试查找包装代币
  if (wrappedMapping[input]) {
    const wrapped = await resolveToken(wrappedMapping[input]);
    if (wrapped) {
      console.log(`找到包装代币 ${wrappedMapping[input]} 替代 ${input}`);
      
      // 创建一个基于包装代币的修改版本
      const derivedToken: TokenInfo = {
        name: wrapped.name.replace('Wrapped ', ''),
        symbol: input,
        address: wrapped.address,
        decimals: wrapped.decimals,
        source: 'derived_unwrapped',
        wrappedVersion: wrapped
      };
      
      // 缓存结果
      tokenCache[input] = derivedToken;
      return derivedToken;
    }
  }
  
  // 5. 如果仍未找到，尝试使用代币列表服务
  if (!tokenListsCache || (Date.now() - lastTokenListFetch > 3600000)) {
    try {
      console.log('刷新代币列表缓存...');
      const response = await axios.get('https://token.jup.ag/all');
      if (response.data) {
        tokenListsCache = response.data;
        lastTokenListFetch = Date.now();
      }
    } catch (error) {
      console.error('获取代币列表失败:', error);
    }
  }
  
  if (tokenListsCache) {
    // 尝试通过符号匹配
    const token = tokenListsCache.find((t: any) => 
      t.symbol.toUpperCase() === input || 
      t.name.toUpperCase() === input
    );
    
    if (token) {
      console.log(`从代币列表找到: ${token.symbol} (${token.name})`);
      
      const tokenInfo: TokenInfo = {
        name: token.name,
        symbol: token.symbol.toUpperCase(),
        address: token.address,
        decimals: token.decimals,
        chainId: token.chainId,
        logoURI: token.logoURI,
        source: 'tokenlist'
      };
      
      // 缓存结果
      tokenCache[input] = tokenInfo;
      return tokenInfo;
    }
  }
  
  console.log(`未找到代币: ${input}`);
  return null;
}

/**
 * 检查代币符号是否有效
 * @param symbol 代币符号
 * @returns 是否有效
 */
export async function isValidToken(symbol: string): Promise<boolean> {
  const token = await resolveToken(symbol);
  return token !== null;
}

export default {
  resolveToken,
  isValidToken
};