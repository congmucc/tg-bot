/**
 * 代币配置
 * 包含主要代币地址和配置
 */

interface TokenConfig {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  chainId?: number; // Ethereum: 1, Solana: 101
}

/**
 * 代币列表类型（按区块链）
 */
interface TokenLists {
  ethereum: {
    [symbol: string]: TokenConfig;
  };
  solana: {
    [symbol: string]: TokenConfig;
  };
}

/**
 * 代币列表配置
 */
export const tokens: TokenLists = {
  ethereum: {
    BTC: {
      name: 'Bitcoin (Wrapped)',
      symbol: 'BTC',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC合约地址
      decimals: 8,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png'
    },
    ETH: {
      name: 'Ethereum',
      symbol: 'ETH',
      address: 'native', // 原生代币
      decimals: 18,
      chainId: 1,
      logoURI: 'https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/6ed5f/eth-diamond-black.webp'
    },
    WETH: {
      name: 'Wrapped Ethereum',
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      chainId: 1
    },
    USDT: {
      name: 'Tether',
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      chainId: 1
    },
    USDC: {
      name: 'USD Coin',
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      chainId: 1
    },
    UNI: {
      name: 'Uniswap',
      symbol: 'UNI',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
      chainId: 1
    },
    DAI: {
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      chainId: 1
    },
  },
  solana: {
    SOL: {
      name: 'Solana',
      symbol: 'SOL',
      address: 'native', // 原生代币
      decimals: 9,
      chainId: 101,
      logoURI: 'https://static.coingecko.com/s/cg_tokens/26483/large/solana.png'
    },
    WSOL: {
      name: 'Wrapped Solana',
      symbol: 'WSOL',
      address: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      chainId: 101
    },
    WETH: {
      name: 'Wrapped Ethereum',
      symbol: 'WETH',
      address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
      decimals: 8,
      chainId: 101
    },
    USDT: {
      name: 'Tether',
      symbol: 'USDT',
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      decimals: 6,
      chainId: 101
    },
    USDC: {
      name: 'USD Coin',
      symbol: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      chainId: 101
    },
    RAY: {
      name: 'Raydium',
      symbol: 'RAY',
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      decimals: 6,
      chainId: 101
    },
    SRM: {
      name: 'Serum',
      symbol: 'SRM',
      address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
      decimals: 6,
      chainId: 101
    },
    COPE: {
      name: 'COPE',
      symbol: 'COPE',
      address: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
      decimals: 6,
      chainId: 101
    }
  }
};

/**
 * 按符号获取代币配置
 * @param symbol 代币符号
 * @param chain 区块链 (ethereum | solana)
 */
export function getTokenBySymbol(symbol: string, chain: 'ethereum' | 'solana'): TokenConfig | null {
  const chainTokens = tokens[chain];
  return chainTokens[symbol.toUpperCase()] || null;
}

/**
 * 按地址获取代币配置
 * @param address 代币地址
 * @param chain 区块链 (ethereum | solana)
 */
export function getTokenByAddress(address: string, chain: 'ethereum' | 'solana'): TokenConfig | null {
  const chainTokens = tokens[chain];
  address = address.toLowerCase();
  
  for (const tokenSymbol in chainTokens) {
    const token = chainTokens[tokenSymbol];
    if (token.address.toLowerCase() === address) {
      return token;
    }
  }
  
  return null;
}

/**
 * 获取链上所有代币列表
 * @param chain 区块链 (ethereum | solana)
 */
export function getTokenList(chain: 'ethereum' | 'solana'): TokenConfig[] {
  const chainTokens = tokens[chain];
  return Object.values(chainTokens);
}

export default {
  tokens,
  getTokenBySymbol,
  getTokenByAddress,
  getTokenList
}; 