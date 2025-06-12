import axios from 'axios';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from '../../config';

class SolanaAPI {
  private connection: Connection;
  private solscanApiKey: string;

  constructor() {
    this.connection = new Connection(config.SOLANA_RPC_URL);
    this.solscanApiKey = config.SOLSCAN_API_KEY || '';
  }

  /**
   * 获取代币信息
   * @param tokenAddress 代币地址
   */
  async getTokenInfo(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }> {
    try {
      const tokenPublicKey = new PublicKey(tokenAddress);
      
      // 使用Solscan API获取代币信息
      const response = await axios.get(`https://public-api.solscan.io/token/meta`, {
        params: {
          tokenAddress
        },
        headers: this.solscanApiKey ? {
          'accept': 'application/json',
          'token': this.solscanApiKey
        } : {
          'accept': 'application/json'
        }
      });
      
      const tokenInfo = response.data;
      
      return {
        name: tokenInfo.name || 'Unknown',
        symbol: tokenInfo.symbol || 'Unknown',
        decimals: tokenInfo.decimals || 0,
        totalSupply: tokenInfo.supply || '0'
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana代币信息失败: ${err.message}`);
    }
  }

  /**
   * 获取账户余额
   * @param address 账户地址
   */
  async getAccountBalance(address: string): Promise<{
    solBalance: string;
    usdValue?: number;
  }> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      
      return {
        solBalance: (balance / LAMPORTS_PER_SOL).toString()
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana账户余额失败: ${err.message}`);
    }
  }

  /**
   * 获取代币余额
   * @param tokenAddress 代币地址
   * @param walletAddress 钱包地址
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<{
    tokenSymbol: string;
    balance: string;
    decimals: number;
  }> {
    try {
      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      // 获取代币账户
      const response = await axios.get(`https://public-api.solscan.io/account/tokens`, {
        params: {
          account: walletAddress
        },
        headers: this.solscanApiKey ? {
          'accept': 'application/json',
          'token': this.solscanApiKey
        } : {
          'accept': 'application/json'
        }
      });
      
      // 查找特定代币
      const token = response.data.find((t: any) => t.tokenAddress === tokenAddress);
      
      if (!token) {
        return {
          tokenSymbol: tokenInfo.symbol,
          balance: '0',
          decimals: tokenInfo.decimals
        };
      }
      
      return {
        tokenSymbol: tokenInfo.symbol,
        balance: (token.tokenAmount.uiAmount || 0).toString(),
        decimals: tokenInfo.decimals
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana代币余额失败: ${err.message}`);
    }
  }

  /**
   * 获取最近的区块信息
   */
  async getLatestBlockInfo(): Promise<{
    number: number;
    timestamp: number;
    hash: string;
    transactions: number;
  }> {
    try {
      const blockHeight = await this.connection.getBlockHeight();
      const block = await this.connection.getBlock(blockHeight);
      
      if (!block) {
        throw new Error('无法获取区块信息');
      }
      
      return {
        number: blockHeight,
        timestamp: block.blockTime ? block.blockTime * 1000 : Date.now(),
        hash: block.blockhash,
        transactions: block.transactions ? block.transactions.length : 0
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana区块信息失败: ${err.message}`);
    }
  }

  /**
   * 获取大额转账
   * @param minValue 最小SOL价值
   * @param limit 返回数量限制
   */
  async getLargeTransactions(minValue = 1000, limit = 10): Promise<any> {
    try {
      const response = await axios.get(`https://public-api.solscan.io/transaction/last`, {
        params: {
          limit: Math.min(50, limit * 3) // 获取更多交易然后过滤，因为并非所有交易都是大额转账
        },
        headers: this.solscanApiKey ? {
          'accept': 'application/json',
          'token': this.solscanApiKey
        } : {
          'accept': 'application/json'
        }
      });
      
      // 如果API返回空数据，抛出错误
      if (!response.data || response.data.length === 0) {
        throw new Error('未获取到Solana交易');
      }
      
      // 过滤大额交易
      const minValueLamports = minValue * LAMPORTS_PER_SOL;
      const largeTransactions = [];
      
      // 尝试处理每笔交易
      let processedCount = 0;
      for (const tx of response.data) {
        try {
          processedCount++;
          if (processedCount > 10) break; // 最多处理10笔交易避免过多请求
          
          const txDetails = await axios.get(`https://public-api.solscan.io/transaction/${tx.txHash}`, {
            headers: this.solscanApiKey ? {
              'accept': 'application/json',
              'token': this.solscanApiKey
            } : {
              'accept': 'application/json'
            }
          });
          
          // 如果找不到价值或者SOL价值为0，跳过
          if (!txDetails.data || !txDetails.data.signer || !txDetails.data.lamport) {
            continue;
          }
          
          // 检查交易金额是否满足最小值要求
          const solValue = txDetails.data.lamport / LAMPORTS_PER_SOL;
          if (solValue >= minValue) {
            largeTransactions.push({
              hash: tx.txHash,
              from: txDetails.data.signer,
              to: txDetails.data.mainActions && txDetails.data.mainActions.length > 0 
                ? txDetails.data.mainActions[0].data.destination 
                : 'Unknown',
              value: solValue.toFixed(4),
              timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
              blockNumber: tx.slot || 0
            });
          }
          
          // 如果已经收集到足够的大额交易，退出
          if (largeTransactions.length >= limit) {
            break;
          }
        } catch (innerError) {
          // 单个交易处理失败，继续处理下一个
          continue;
        }
      }
      
      if (largeTransactions.length === 0) {
        throw new Error('未找到符合条件的大额交易');
      }
      
      return largeTransactions;
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana大额转账失败: ${err.message}`);
    }
  }
}

export default new SolanaAPI(); 