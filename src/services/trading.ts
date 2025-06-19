import { ethers } from 'ethers';
import { getBlockchainAPI } from '../api/blockchain';

// 路由ABI (简化版)
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

// ERC20 代币 ABI (简化版)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

/**
 * 交易执行模拟结果
 */
export interface TradeSimulationResult {
  success: boolean;
  inputAmount: string;
  expectedOutputAmount?: string;
  minimumOutputAmount?: string;
  priceImpact?: string;
  error?: string;
}

/**
 * 模拟交易执行
 * @param chain 区块链类型
 * @param routerAddress 路由合约地址
 * @param path 交易路径
 * @param amountIn 输入金额
 * @param slippageTolerance 滑点容忍度
 */
export async function simulateTrade(
  chain: 'ethereum' | 'solana',
  routerAddress: string,
  path: string[],
  amountIn: string,
  slippageTolerance = 0.5
): Promise<TradeSimulationResult> {
  try {
    // 仅支持以太坊链上交易模拟
    if (chain !== 'ethereum') {
      throw new Error(`${chain} 链上交易模拟暂不支持`);
    }

    const api = getBlockchainAPI(chain);
    const provider = (api as any).provider;

    // 创建路由合约实例
    const routerContract = new ethers.Contract(routerAddress, ROUTER_ABI, provider);

    // 转换输入金额
    const tokenInContract = new ethers.Contract(path[0], ERC20_ABI, provider);
    const tokenInDecimals = await tokenInContract.decimals();
    const amountInWei = ethers.utils.parseUnits(amountIn, tokenInDecimals);

    // 获取预期输出金额
    const amounts = await routerContract.getAmountsOut(amountInWei, path);

    // 转换输出金额
    const tokenOutContract = new ethers.Contract(path[path.length - 1], ERC20_ABI, provider);
    const tokenOutDecimals = await tokenOutContract.decimals();
    const outputAmount = ethers.utils.formatUnits(amounts[amounts.length - 1], tokenOutDecimals);

    // 计算最小输出金额 (考虑滑点)
    const minimumOutputAmountWei = amounts[amounts.length - 1]
      .mul(ethers.BigNumber.from(Math.floor(10000 - slippageTolerance * 100)))
      .div(ethers.BigNumber.from(10000));

    const minimumOutputAmount = ethers.utils.formatUnits(minimumOutputAmountWei, tokenOutDecimals);

    // 计算价格影响 (简化计算，实际情况更复杂)
    const priceImpact = 0.1; // 假设有0.1%的价格影响

    return {
      success: true,
      inputAmount: amountIn,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount,
      priceImpact: `${priceImpact.toFixed(2)}%`
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      inputAmount: amountIn,
      error: err.message
    };
  }
}

/**
 * 格式化交易预览消息
 * @param result 交易模拟结果
 * @param inputSymbol 输入代币符号
 * @param outputSymbol 输出代币符号
 */
export function formatTradePreview(
  result: TradeSimulationResult,
  inputSymbol: string,
  outputSymbol: string
): string {
  if (!result.success) {
    return `❌ 交易模拟失败: ${result.error}`;
  }

  return `
💱 *交易预览: ${inputSymbol} → ${outputSymbol}*
--------------------------
📤 您将支付: ${result.inputAmount} ${inputSymbol}
📥 预计获得: ${result.expectedOutputAmount} ${outputSymbol}
🔄 最低获得: ${result.minimumOutputAmount} ${outputSymbol}
📊 价格影响: ${result.priceImpact}
⚠️ 注意: 此为模拟结果，实际交易可能因市场波动有所差异
  `;
}

/**
 * 计算平均成交价格
 * @param inputAmount 输入金额
 * @param outputAmount 输出金额
 */
export function calculateExecutionPrice(inputAmount: number, outputAmount: number): number {
  if (!outputAmount || outputAmount === 0) return 0;
  return inputAmount / outputAmount;
}

export default {
  simulateTrade,
  formatTradePreview,
  calculateExecutionPrice
}; 