import ethereumAPI from './ethereum';
import solanaAPI from './solana';
import hyperliquidAPI from './hyperliquidApi';
import bitcoinAPI from './bitcoin';

/**
 * 区块链网络类型
 */
export type BlockchainType = 'ethereum' | 'solana' | 'hyperliquid' | 'bitcoin';

/**
 * 区块链API集合
 */
const blockchainApi = {
  ethereum: ethereumAPI,
  solana: solanaAPI,
  hyperliquid: hyperliquidAPI,
  bitcoin: bitcoinAPI
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
 * @param minValueBtc 比特币上的最小交易额(BTC)
 * @param minValueHl Hyperliquid上的最小交易额(USD)
 * @param includeEthereum 是否包括以太坊监控
 * @param includeSolana 是否包括Solana监控
 * @param includeBitcoin 是否包括比特币监控
 * @param includeHyperliquid 是否包括Hyperliquid监控
 */
export async function monitorLargeTransactions(
  minValueEth = 100,
  minValueSol = 1000,
  minValueBtc = 10,
  minValueHl = 100000,
  includeEthereum = true,
  includeSolana = true,
  includeBitcoin = true,
  includeHyperliquid = true
) {
  const results = [];
  
  // 获取以太坊大额交易
  if (includeEthereum) {
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
  }
  
  // 获取Solana大额交易
  if (includeSolana) {
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
  }

  // 获取比特币大额交易
  if (includeBitcoin) {
    try {
      const bitcoinTransactions = await bitcoinAPI.getLargeTransactions(minValueBtc);
      results.push({
        chain: 'bitcoin',
        transactions: bitcoinTransactions,
        count: bitcoinTransactions.length,
        success: true
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        chain: 'bitcoin',
        error: err.message,
        success: false
      });
    }
  }

  // 获取Hyperliquid大额交易
  if (includeHyperliquid) {
    try {
      const hyperliquidTransactions = await hyperliquidAPI.getLargeTransactions(minValueHl);
      results.push({
        chain: 'hyperliquid',
        transactions: hyperliquidTransactions,
        count: hyperliquidTransactions.length,
        success: true
      });
    } catch (error) {
      const err = error as Error;
      results.push({
        chain: 'hyperliquid',
        error: err.message,
        success: false
      });
    }
  }
  
  return results;
}

export default {
  ethereumAPI,
  solanaAPI,
  bitcoinAPI,
  hyperliquidAPI,
  getBlockchainAPI,
  getBalanceAcrossChains,
  monitorLargeTransactions
};