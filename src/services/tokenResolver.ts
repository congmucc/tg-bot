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
    console.log(`从缓存获取代币信息: ${input}`);
    return tokenCache[input];
  }
  
  // 2. 查询CoinGecko (提升到第一位)
  try {
    const coinGeckoToken = await searchCoinGecko(input);
    if (coinGeckoToken) {
      tokenCache[input] = coinGeckoToken;
      return coinGeckoToken;
    }
  } catch (error) {
    console.error(`CoinGecko查询失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. 检查本地配置 (降低优先级)
  const ethereumToken = getTokenBySymbol(input, 'ethereum');
  const solanaToken = getTokenBySymbol(input, 'solana');
  
  if (ethereumToken) {
    const token = {
      ...ethereumToken,
      source: 'config'
    };
    tokenCache[input] = token;
    return token;
  }
  
  if (solanaToken) {
    const token = {
      ...solanaToken,
      source: 'config'
    };
    tokenCache[input] = token;
    return token;
  }
  
  // 4. 检查包装代币的情况
  if (input.startsWith('W') && input.length > 1) {
    const unwrappedSymbol = input.substring(1);
    const unwrappedToken = await resolveToken(unwrappedSymbol);
    
    if (unwrappedToken) {
      // 创建包装代币信息
      const wrappedToken = {
        name: `Wrapped ${unwrappedToken.name}`,
        symbol: input,
        decimals: unwrappedToken.decimals,
        chainId: unwrappedToken.chainId,
        source: 'derived',
      };
      tokenCache[input] = wrappedToken;
      return wrappedToken;
    }
  }
  
  // 5. 查询Token Lists
  try {
    const tokenListToken = await searchTokenLists(input);
    if (tokenListToken) {
      tokenCache[input] = tokenListToken;
      return tokenListToken;
    }
  } catch (error) {
    console.error(`Token Lists查询失败: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 未找到代币
  return null;
}

/**
 * 从CoinGecko搜索代币信息
 */
async function searchCoinGecko(input: string): Promise<TokenInfo | null> {
  try {
    // 使用CoinGecko search API
    const response = await axios.get(`https://api.coingecko.com/api/v3/search?query=${input}`);
    
    if (response.data && response.data.coins && response.data.coins.length > 0) {
      // 尝试找到精确匹配
      const exactMatches = response.data.coins.filter(
        (coin: any) => coin.symbol.toUpperCase() === input.toUpperCase()
      );
      
      // 优先使用精确匹配的结果
      const bestMatch = exactMatches.length > 0 ? exactMatches[0] : response.data.coins[0];
      
      // 获取更详细的代币信息
      const coinInfo = await axios.get(`https://api.coingecko.com/api/v3/coins/${bestMatch.id}`);
      
      if (coinInfo.data) {
        return {
          name: coinInfo.data.name,
          symbol: coinInfo.data.symbol.toUpperCase(),
          decimals: 18, // CoinGecko不直接提供精度，使用默认值
          logoURI: coinInfo.data.image.small,
          source: 'coingecko',
          id: bestMatch.id
        };
      }
    }
    
    return null;
  } catch (error) {
    console.log(`CoinGecko搜索出错: ${input}`, error);
    return null;
  }
}

/**
 * 加载和搜索主流Token Lists
 */
async function searchTokenLists(input: string): Promise<TokenInfo | null> {
  try {
    // 每小时更新一次token lists缓存
    const now = Date.now();
    if (!tokenListsCache || now - lastTokenListFetch > 3600000) {
      lastTokenListFetch = now;
      tokenListsCache = await loadTokenLists();
    }
    
    // 在lists中搜索匹配项
    for (const key in tokenListsCache) {
      const list = tokenListsCache[key] as any[];
      for (const token of list) {
        if (token.symbol.toUpperCase() === input.toUpperCase()) {
          return {
            name: token.name,
            symbol: token.symbol.toUpperCase(),
            address: token.address,
            decimals: token.decimals,
            chainId: token.chainId,
            logoURI: token.logoURI,
            source: 'tokenlist'
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log(`Token Lists搜索出错: ${input}`, error);
    return null;
  }
}

/**
 * 加载主流Token Lists
 */
async function loadTokenLists(): Promise<Record<string, any[]>> {
  try {
    // 并行加载多个token lists
    const [uniswapResponse, sushiResponse] = await Promise.all([
      axios.get('https://gateway.ipfs.io/ipns/tokens.uniswap.org'),
      axios.get('https://token-list.sushi.com')
    ]);
    
    return {
      uniswap: uniswapResponse.data.tokens || [],
      sushi: sushiResponse.data.tokens || []
    };
  } catch (error) {
    console.error('加载Token Lists失败:', error);
    return { uniswap: [], sushi: [] };
  }
}

/**
 * 检查代币是否有效
 */
export async function isValidToken(input: string): Promise<boolean> {
  const token = await resolveToken(input);
  return token !== null;
}

export default {
  resolveToken,
  isValidToken
};