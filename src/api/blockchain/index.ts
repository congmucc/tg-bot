import ethereumAPI from './ethereum';
import solanaAPI from './solana';

/**
 * 区块链网络类型
 */
export type BlockchainType = 'ethereum' | 'solana';

/**
 * 区块链API集合
 */
const blockchainApi = {
  ethereum: ethereumAPI,
  solana: solanaAPI
};

/**
 * 按网络类型获取对应的API
 * @param chain 区块链网络类型
 */
export function getBlockchainAPI(chain: BlockchainType) {
  return blockchainApi[chain];
}

/**
 * 获取特定地址在所有支持的区块链上的余额
 * @param address 钱包地址
 */
export async function getBalanceAcrossChains(address: string) {
  const results = [];
  
  try {
    // 获取以太坊余额
    try {
      const ethBalance = await ethereumAPI.getAccountBalance(address);
      results.push({
        chain: 'ethereum',
        balance: ethBalance.ethBalance,
        symbol: 'ETH',
        success: true
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        chain: 'ethereum',
        error: err.message,
        success: false
      });
    }
    
    // 获取Solana余额
    try {
      const solanaBalance = await solanaAPI.getAccountBalance(address);
      results.push({
        chain: 'solana',
        balance: solanaBalance.solBalance,
        symbol: 'SOL',
        success: true
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        chain: 'solana',
        error: err.message,
        success: false
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error(`获取跨链余额失败: ${err.message}`);
  }
  
  return results;
}

/**
 * 监控跨链大额交易
 * @param minValueEth 以太坊上的最小交易额(ETH)
 * @param minValueSol Solana上的最小交易额(SOL)
 */
export async function monitorLargeTransactions(minValueEth = 100, minValueSol = 1000) {
  const results = [];
  
  // 获取以太坊大额交易
  try {
    const ethTransactions = await ethereumAPI.getLargeTransactions(minValueEth);
    results.push({
      chain: 'ethereum',
      transactions: ethTransactions,
      count: ethTransactions.length,
      success: true
    });
  } catch (error) {
    const err = error as Error;
    results.push({
      chain: 'ethereum',
      error: err.message,
      success: false
    });
  }
  
  // 获取Solana大额交易
  try {
    const solanaTransactions = await solanaAPI.getLargeTransactions(minValueSol);
    results.push({
      chain: 'solana',
      transactions: solanaTransactions,
      count: solanaTransactions.length,
      success: true
    });
  } catch (error) {
    const err = error as Error;
    results.push({
      chain: 'solana',
      error: err.message,
      success: false
    });
  }
  
  return results;
}

export default {
  ethereumAPI,
  solanaAPI,
  getBlockchainAPI,
  getBalanceAcrossChains,
  monitorLargeTransactions
}; 