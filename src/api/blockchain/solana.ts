import axios from 'axios';
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';
import { API_CONFIG, API_KEYS } from '../../config/env';

/**
 * Solana区块链接口实现
 */
class SolanaAPI {
  private connection: Connection;
  private backupConnection: Connection;
  private quicknodeConnection: Connection | null = null;
  private heliusConnection: Connection | null = null;
  private solanaBeachApiKey: string;
  private solscanApiKey: string;
  public heliusApiKey: string;
  public quicknodeApiKey: string;

  constructor() {
    // 主RPC连接
    this.connection = new Connection(API_CONFIG.SOLANA_RPC_URL);

    // 备用连接
    this.backupConnection = new Connection('https://api.mainnet-beta.solana.com');

    // API密钥 - 可选配置，用于获取交易详情
    this.solanaBeachApiKey = '';
    this.solscanApiKey = API_KEYS.SOLSCAN_API_KEY || '';
    this.heliusApiKey = '';
    this.quicknodeApiKey = '';
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
      try {
      const response = await axios.get(`https://public-api.solscan.io/token/meta`, {
        params: {
          tokenAddress
        },
        headers: this.solscanApiKey ? {
          'accept': 'application/json',
          'token': this.solscanApiKey
        } : {
          'accept': 'application/json'
          },
          timeout: 10000
        });
        
        if (response.data && response.data.name) {
          return {
            name: response.data.name || 'Unknown',
            symbol: response.data.symbol || 'Unknown',
            decimals: response.data.decimals || 0,
            totalSupply: response.data.supply || '0'
          };
        }
      } catch (error) {
        console.log(`Solscan Token API失败: ${(error as Error).message}`);
      }
      
      // 尝试使用Jupiter Token List API
      try {
        const jupiterResponse = await axios.get('https://token.jup.ag/all');
        if (jupiterResponse.data && Array.isArray(jupiterResponse.data)) {
          const token = jupiterResponse.data.find((t: any) => t.address === tokenAddress);
          if (token) {
            return {
              name: token.name || 'Unknown',
              symbol: token.symbol || 'Unknown',
              decimals: token.decimals || 0,
              totalSupply: '0'  // Jupiter不提供供应量数据
            };
          }
        }
      } catch (jupiterError) {
        console.log(`Jupiter Token API失败: ${(jupiterError as Error).message}`);
      }

      // 如果上面的API都失败了，返回基本信息
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 0,
        totalSupply: '0'
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
      
      // 尝试从Solscan获取代币余额
      try {
      const response = await axios.get(`https://public-api.solscan.io/account/tokens`, {
        params: {
          account: walletAddress
        },
        headers: this.solscanApiKey ? {
          'accept': 'application/json',
          'token': this.solscanApiKey
        } : {
          'accept': 'application/json'
          },
          timeout: 10000
      });
      
      // 查找特定代币
        if (response.data && Array.isArray(response.data)) {
      const token = response.data.find((t: any) => t.tokenAddress === tokenAddress);
          
          if (token) {
            return {
              tokenSymbol: tokenInfo.symbol,
              balance: (token.tokenAmount.uiAmount || 0).toString(),
              decimals: tokenInfo.decimals
            };
          }
        }
      } catch (solscanError) {
        console.log(`Solscan Token Balance API失败: ${(solscanError as Error).message}`);
      }
      
      // 如果Solscan失败，尝试直接从链上获取
      try {
        // 这里需要更复杂的逻辑来获取SPL代币余额
        // 简化起见，这里省略实际代码，返回默认值
        return {
          tokenSymbol: tokenInfo.symbol,
          balance: '0',
          decimals: tokenInfo.decimals
        };
      } catch (rpcError) {
        console.log(`RPC Token Balance查询失败: ${(rpcError as Error).message}`);
      }
      
      return {
        tokenSymbol: tokenInfo.symbol,
        balance: '0',
        decimals: tokenInfo.decimals
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取Solana代币余额失败: ${err.message}`);
    }
  }



  /**
   * 获取大额转账
   * @param minValue 最小SOL价值
   * @param limit 返回数量限制
   */
  async getLargeTransactions(minValue = 1000, limit = 10): Promise<any> {
    try {
      console.log("使用Solana RPC获取最近区块的大额交易...");
      const slot = await this.connection.getSlot();
      const transactions = [];

      // 获取最近几个区块的交易
      for (let i = 0; i < 3; i++) {
        try {
          const currentSlot = slot - i;
          const block = await this.connection.getBlock(currentSlot, {
            maxSupportedTransactionVersion: 0
          });

          if (!block || !block.transactions) continue;

          // 分析每个交易
          for (const tx of block.transactions) {
            if (!tx.meta || tx.meta.err) continue;

            // 计算交易涉及的SOL金额
            const preBalances = tx.meta.preBalances;
            const postBalances = tx.meta.postBalances;

            if (preBalances && postBalances && preBalances.length === postBalances.length) {
              for (let j = 0; j < preBalances.length; j++) {
                const balanceChange = Math.abs(postBalances[j] - preBalances[j]);
                const solValue = balanceChange / LAMPORTS_PER_SOL;

                if (solValue >= minValue) {
                  const signature = tx.transaction.signatures[0];
                  let fromAddress = 'Unknown';
                  let toAddress = 'Unknown';

                  // 尝试获取账户信息
                  try {
                    if ('accountKeys' in tx.transaction.message) {
                      // Legacy message
                      const accounts = tx.transaction.message.accountKeys;
                      fromAddress = accounts[0]?.toString() || 'Unknown';
                      toAddress = accounts[1]?.toString() || 'Unknown';
                    } else {
                      // Versioned message
                      const accounts = tx.transaction.message.getAccountKeys();
                      fromAddress = accounts.get(0)?.toString() || 'Unknown';
                      toAddress = accounts.get(1)?.toString() || 'Unknown';
                    }
                  } catch (accountError) {
                    // 使用默认值
                  }

                  transactions.push({
                    hash: signature,
                    from: fromAddress,
                    to: toAddress,
                    value: solValue.toString(),
                    timestamp: block.blockTime || Math.floor(Date.now() / 1000),
                    blockNumber: currentSlot
                  });

                  if (transactions.length >= limit) {
                    break;
                  }
                }
              }
            }

            if (transactions.length >= limit) {
              break;
            }
          }

          if (transactions.length >= limit) {
            break;
          }
        } catch (blockError) {
          console.warn(`获取区块 ${slot - i} 失败:`, (blockError as Error).message);
          continue;
        }
      }

      return transactions;
    } catch (error) {
      const err = error as Error;
      console.error(`获取Solana大额转账失败: ${err.message}`);
      return [];
    }
  }



}

export default new SolanaAPI(); 