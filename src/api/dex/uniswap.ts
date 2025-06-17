import { ethers } from 'ethers';
import { config } from '../../config';
import axios from 'axios';
import { getTokenBySymbol } from '../../config/tokens';
import { ExchangeType, IDexApi, BlockchainType, PriceResult } from '../interfaces/exchangeApi';

// Uniswap V3 Factory ABI (简化版)
const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

// Uniswap V3 Pool ABI (简化版)
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)'
];

// ERC20 代币 ABI (简化版)
const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

/**
 * Uniswap API接口
 */
class UniswapAPI implements IDexApi {
  public provider: ethers.providers.JsonRpcProvider;
  public factoryAddress: string;
  public factoryContract: ethers.Contract;
  public graphUrl: string;
  public commonPoolFees: number[] = [500, 3000, 10000]; // Uniswap V3 常见费率: 0.05%, 0.3%, 1%

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.ETHEREUM_RPC_URL);
    this.factoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // Uniswap V3 工厂合约
    this.factoryContract = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    this.graphUrl = config.UNISWAP_GRAPH_URL;
  }

  /**
   * 获取交易所名称
   */
  public getName(): string {
    return 'uniswap';
  }
  
  /**
   * 获取交易所类型
   */
  public getType(): ExchangeType {
    return ExchangeType.DEX;
  }
  
  /**
   * 获取区块链类型
   */
  public getBlockchain(): BlockchainType {
    return BlockchainType.ETHEREUM;
  }

  /**
   * 获取交易对池地址
   * @param tokenA 代币A地址
   * @param tokenB 代币B地址
   * @param fee 手续费率
   * @returns 池合约地址
   */
  async getPoolAddress(tokenA: string, tokenB: string, fee: number): Promise<string> {
    try {
      const poolAddress = await this.factoryContract.getPool(tokenA, tokenB, fee);
      if (poolAddress === ethers.constants.AddressZero) {
        throw new Error(`交易对不存在: ${tokenA}-${tokenB} 费率:${fee}`);
      }
      return poolAddress;
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取交易对地址失败: ${err.message}`);
    }
  }
  
  /**
   * 查找最佳流动性池
   * @param tokenA 代币A地址
   * @param tokenB 代币B地址
   * @returns 池地址和费率
   */
  async findBestPool(tokenA: string, tokenB: string): Promise<{poolAddress: string, fee: number}> {
    for (const fee of this.commonPoolFees) {
      try {
        const poolAddress = await this.getPoolAddress(tokenA, tokenB, fee);
        return { poolAddress, fee };
      } catch (error) {
        console.log(`[Uniswap] 未找到费率为 ${fee} 的池子，尝试下一个费率...`);
      }
    }
    throw new Error(`未找到任何 ${tokenA}-${tokenB} 流动性池`);
  }

  /**
   * 获取代币价格
   * @param tokenSymbol 代币符号
   * @param baseTokenSymbol 基础代币符号（如USDT）
   */
  async getTokenPrice(tokenSymbol: string, baseTokenSymbol = 'USDT'): Promise<PriceResult> {
    try {
      // 处理ETH特殊情况 - 使用WETH
      let actualTokenSymbol = tokenSymbol;
      if (tokenSymbol.toUpperCase() === 'ETH') {
        actualTokenSymbol = 'WETH';
        console.log('[Uniswap] 使用WETH代替ETH');
      }
      
      // 对于SOL，在以太坊上可能没有直接的交易对
      if (tokenSymbol.toUpperCase() === 'SOL' && baseTokenSymbol.toUpperCase() === 'USDC') {
        console.log('[Uniswap] SOL在以太坊上可能没有直接的USDC交易对，尝试通过第三方API获取');
        
        // 尝试通过CoinGecko获取SOL价格
        try {
          console.log('[Uniswap] 尝试从CoinGecko获取SOL/USDC价格...');
          const geckoResponse = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
            { timeout: 10000 }
          );
          
          if (geckoResponse.data && geckoResponse.data.solana && geckoResponse.data.solana.usd) {
            const price = geckoResponse.data.solana.usd;
            console.log(`[Uniswap] 从CoinGecko获取的SOL价格: ${price}`);
            return {
              exchange: this.getName(),
              exchangeType: this.getType(),
              blockchain: this.getBlockchain(),
              success: true,
              price: price,
              timestamp: Date.now()
            };
          }
        } catch (geckoError) {
          console.error('[Uniswap] CoinGecko API获取SOL价格失败:', geckoError);
        }
      }
      
      // 获取代币信息
      const token = getTokenBySymbol(actualTokenSymbol, 'ethereum');
      const baseToken = getTokenBySymbol(baseTokenSymbol, 'ethereum');
      
      if (!token || !baseToken) {
        return {
          exchange: this.getName(),
          exchangeType: this.getType(),
          blockchain: this.getBlockchain(),
          success: false,
          error: `代币信息不存在: ${!token ? actualTokenSymbol : baseTokenSymbol}`
        };
      }

      // 直接尝试使用可靠的第三方API获取价格
      try {
        // 尝试通过CoinGecko获取
        console.log(`[Uniswap] 尝试从CoinGecko获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
        const geckoResponse = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=${tokenSymbol.toLowerCase()}&vs_currencies=usd`,
          { timeout: 10000 }
        );
        
        if (geckoResponse.data && 
            geckoResponse.data[tokenSymbol.toLowerCase()] && 
            geckoResponse.data[tokenSymbol.toLowerCase()].usd) {
          const price = geckoResponse.data[tokenSymbol.toLowerCase()].usd;
          console.log(`[Uniswap] 从CoinGecko获取的价格: ${price}`);
          return {
            exchange: this.getName(),
            exchangeType: this.getType(),
            blockchain: this.getBlockchain(),
            success: true,
            price: price,
            timestamp: Date.now()
          };
        }
      } catch (geckoError) {
        console.error('[Uniswap] CoinGecko API失败:', geckoError);
      }
      
      // 尝试通过Binance获取
      try {
        console.log(`[Uniswap] 尝试从Binance获取 ${tokenSymbol}/${baseTokenSymbol} 价格...`);
        
        // 如果是USDC交易对，尝试使用USDT
        let binanceSymbol = `${tokenSymbol}${baseTokenSymbol}`;
        if (baseTokenSymbol.toUpperCase() === 'USDC') {
          binanceSymbol = `${tokenSymbol}USDT`;
          console.log(`[Uniswap] USDC交易对可能不存在，尝试使用USDT交易对: ${binanceSymbol}`);
        }
        
        const binanceResponse = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
          { timeout: 10000 }
        );
        
        if (binanceResponse.data && binanceResponse.data.price) {
          const price = binanceResponse.data.price;
          console.log(`[Uniswap] 从Binance获取的价格: ${price}`);
          return {
            exchange: this.getName(),
            exchangeType: this.getType(),
            blockchain: this.getBlockchain(),
            success: true,
            price: parseFloat(price),
            timestamp: Date.now()
          };
        }
      } catch (binanceError) {
        console.error('[Uniswap] Binance API失败:', binanceError);
      }
      
      // 如果前两种方法都失败，再尝试使用Uniswap链上数据
      console.log('[Uniswap] 第三方API获取价格失败，尝试从链上获取价格');

      // 尝试查找最佳流动性池
      const { poolAddress, fee } = await this.findBestPool(token.address, baseToken.address);
      console.log(`[Uniswap] 找到池子地址: ${poolAddress}, 费率: ${fee/10000}%`);
      
      // 创建池合约
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
      
      // 获取代币顺序
      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();
      
      // 获取当前价格
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // 获取代币精度
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, this.provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, this.provider);
      const token0Decimals = await token0Contract.decimals();
      const token1Decimals = await token1Contract.decimals();
      
      // 计算价格
      // 在Uniswap v3中，价格计算公式为:
      // price = (sqrtPriceX96/2^96)^2
      const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / (2**96);
      const rawPrice = sqrtPrice * sqrtPrice;
      
      // 调整小数位数
      const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
      
      // 检查代币顺序以确定正确的价格方向
      let finalPrice: number;
      const isBaseToken0 = token0Address.toLowerCase() === baseToken.address.toLowerCase();
      const isToken0 = token0Address.toLowerCase() === token.address.toLowerCase();
      
      if (isBaseToken0) {
        // 如果基础代币是token0，则价格为1/price
        finalPrice = (1 / rawPrice) * decimalAdjustment;
      } else {
        // 如果交易代币是token0，则价格为price
        finalPrice = rawPrice * decimalAdjustment;
      }
      
      console.log(`[Uniswap] 计算价格:
        - Raw sqrt价格: ${sqrtPrice}
        - Raw价格: ${rawPrice}
        - 小数位调整: ${decimalAdjustment}
        - 是否基础代币为token0: ${isBaseToken0}
        - 是否交易代币为token0: ${isToken0}
        - 最终价格: ${finalPrice}
      `);
      
      // 如果价格看起来不合理，检查是否需要反转
      if (finalPrice > 10000 || finalPrice < 0.0001) {
        console.log(`[Uniswap] 价格值异常，尝试反转计算`);
        finalPrice = 1 / finalPrice;
      }
      
      console.log(`[Uniswap] ${actualTokenSymbol}/${baseTokenSymbol} 最终价格: ${finalPrice}`);
      
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        blockchain: this.getBlockchain(),
        success: true,
        price: finalPrice,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('[Uniswap] 获取价格失败:', error);
      return {
        exchange: this.getName(),
        exchangeType: this.getType(),
        blockchain: this.getBlockchain(),
        success: false,
        error: (error as Error).message
      };
        }
  }
  
  /**
   * 检查代币是否支持
   * @param tokenSymbol 代币符号
   * @returns 是否支持
   */
  public async isTokenSupported(tokenSymbol: string): Promise<boolean> {
    try {
      const token = getTokenBySymbol(tokenSymbol, 'ethereum');
      return token !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取流动性池信息
   * @param tokenASymbol 代币A符号
   * @param tokenBSymbol 代币B符号
   */
  async getPoolInfo(tokenASymbol: string, tokenBSymbol: string): Promise<any> {
    try {
      // 获取代币信息
      const tokenA = getTokenBySymbol(tokenASymbol, 'ethereum');
      const tokenB = getTokenBySymbol(tokenBSymbol, 'ethereum');
      
      if (!tokenA || !tokenB) {
        throw new Error(`代币信息不存在: ${!tokenA ? tokenASymbol : tokenBSymbol}`);
      }
      
      // 查找最佳流动性池
      const { poolAddress, fee } = await this.findBestPool(tokenA.address, tokenB.address);
      
      // 创建池合约
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
      
      // 获取代币顺序
      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();
      const isTokenA0 = token0Address.toLowerCase() === tokenA.address.toLowerCase();
      
      // 获取当前价格和tick
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const tick = slot0.tick;
      
      // 从Graph API获取额外信息
      const query = `{
        pool(id: "${poolAddress.toLowerCase()}") {
          volumeUSD
          feesUSD
          liquidity
          totalValueLockedUSD
        }
      }`;
      
      const response = await axios.post(this.graphUrl, { query });
      const poolData = response.data.data.pool;
      
      // 计算价格
      const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / (2**96);
      const price = sqrtPrice * sqrtPrice * (10 ** (tokenB.decimals - tokenA.decimals));
      
      // 根据代币顺序确定正确的价格
      const tokenAPrice = isTokenA0 ? price : 1 / price;
      
      return {
        id: poolAddress,
        name: `${tokenASymbol}-${tokenBSymbol}`,
        fee: fee / 1000000, // 转换为小数
        tokenA: {
          symbol: tokenASymbol,
          decimals: tokenA.decimals,
          price: tokenAPrice.toString()
        },
        tokenB: {
          symbol: tokenBSymbol,
          decimals: tokenB.decimals,
          price: (1 / tokenAPrice).toString()
        },
        tick: tick,
        liquidity: poolData.liquidity,
        tvl: poolData.totalValueLockedUSD,
        volume24h: poolData.volumeUSD,
        fees24h: poolData.feesUSD
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Uniswap流动池信息失败: ${err.message}`);
    }
  }
}

export default new UniswapAPI(); 