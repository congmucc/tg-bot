import { ethers } from 'ethers';
import { getBlockchainAPI, BlockchainType } from '../api/blockchain';
import { dexConfigs } from '../config';
import { formatTokenPrice } from './price';

// DEX LP Pair ABI (简化版)
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

// ERC20 代币 ABI (简化版)
const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

/**
 * 获取LP代币信息
 * @param chain 区块链类型
 * @param pairAddress LP对地址
 */
export async function getLPInfo(chain: BlockchainType, pairAddress: string) {
  try {
    const api = getBlockchainAPI(chain);
    const provider = (api as any).provider;
    
    // 创建LP合约实例
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    
    // 获取基本信息
    const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
      pairContract.getReserves(),
      pairContract.totalSupply(),
      pairContract.token0(),
      pairContract.token1()
    ]);
    
    // 获取代币信息
    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
    
    const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
      token0Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.symbol(),
      token1Contract.decimals()
    ]);
    
    // 格式化储备量
    const reserve0 = ethers.utils.formatUnits(reserves[0], token0Decimals);
    const reserve1 = ethers.utils.formatUnits(reserves[1], token1Decimals);
    
    // 计算池子总价值 (需要外部获取价格)
    return {
      pairAddress,
      chain,
      token0: {
        address: token0Address,
        symbol: token0Symbol,
        decimals: token0Decimals,
        reserve: reserve0
      },
      token1: {
        address: token1Address,
        symbol: token1Symbol,
        decimals: token1Decimals,
        reserve: reserve1
      },
      totalSupply: ethers.utils.formatEther(totalSupply),
      timestamp: reserves[2]
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取LP信息失败: ${err.message}`);
  }
}

/**
 * 计算用户LP份额
 * @param chain 区块链类型
 * @param pairAddress LP对地址
 * @param userAddress 用户地址
 */
export async function getUserLPShare(
  chain: BlockchainType,
  pairAddress: string,
  userAddress: string
) {
  try {
    const api = getBlockchainAPI(chain);
    const provider = (api as any).provider;
    
    // 创建LP合约实例
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    
    // 获取用户余额和总供应量
    const [userLPBalance, totalSupply] = await Promise.all([
      pairContract.balanceOf(userAddress),
      pairContract.totalSupply()
    ]);
    
    // 计算份额百分比
    const sharePercent = userLPBalance.mul(ethers.BigNumber.from(10000))
      .div(totalSupply)
      .toNumber() / 100;
    
    // 获取LP代币信息
    const lpInfo = await getLPInfo(chain, pairAddress);
    
    // 计算用户拥有的代币数量
    const userToken0Amount = parseFloat(lpInfo.token0.reserve) * (sharePercent / 100);
    const userToken1Amount = parseFloat(lpInfo.token1.reserve) * (sharePercent / 100);
    
    return {
      pairAddress,
      userAddress,
      chain,
      lpBalance: ethers.utils.formatEther(userLPBalance),
      sharePercent: `${sharePercent.toFixed(4)}%`,
      token0: {
        ...lpInfo.token0,
        userAmount: userToken0Amount.toString()
      },
      token1: {
        ...lpInfo.token1,
        userAmount: userToken1Amount.toString()
      }
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`获取用户LP份额失败: ${err.message}`);
  }
}

/**
 * 计算无常损失
 * @param initialPrice 初始价格比例 (token0/token1)
 * @param currentPrice 当前价格比例 (token0/token1)
 * @returns 无常损失百分比
 */
export function calculateImpermanentLoss(initialPrice: number, currentPrice: number): number {
  // 价格比例变化
  const priceRatio = currentPrice / initialPrice;
  
  // 无常损失公式: 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  const sqrtPriceRatio = Math.sqrt(priceRatio);
  const impermanentLoss = 2 * sqrtPriceRatio / (1 + priceRatio) - 1;
  
  // 转换为百分比
  return impermanentLoss * 100;
}

/**
 * 格式化无常损失消息
 * @param pairSymbol 交易对符号
 * @param loss 损失百分比
 */
export function formatImpermanentLossMessage(pairSymbol: string, loss: number): string {
  const absLoss = Math.abs(loss);
  
  return `
📊 *${pairSymbol} 无常损失分析*
------------------------
📉 损失比例: ${absLoss.toFixed(2)}%
💰 对应资产: 如果直接持有，您将${loss > 0 ? '多' : '少'}拥有约 ${absLoss.toFixed(2)}% 的资产价值
⚠️ 风险级别: ${absLoss < 1 ? '极低' : absLoss < 5 ? '低' : absLoss < 10 ? '中等' : '高'}
  `;
}

export default {
  getLPInfo,
  getUserLPShare,
  calculateImpermanentLoss,
  formatImpermanentLossMessage
}; 