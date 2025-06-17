import axios from 'axios';

/**
 * Bitcoin API 类
 * 用于获取比特币网络的大额交易信息
 */
class BitcoinAPI {
  private baseUrl = 'https://blockstream.info/api';

  /**
   * 获取大额转账
   * @param minValue 最小BTC价值
   * @param limit 返回数量限制
   */
  async getLargeTransactions(minValue = 10, limit = 10): Promise<any[]> {
    try {
      console.log(`获取比特币大额交易，最小值: ${minValue} BTC`);
      
      // 获取最新区块
      const latestBlockResponse = await axios.get(`${this.baseUrl}/blocks/tip/height`, {
        timeout: 10000
      });
      
      if (!latestBlockResponse.data) {
        return [];
      }
      
      const latestHeight = latestBlockResponse.data;
      const transactions = [];
      
      // 检查最近几个区块
      for (let i = 0; i < 5 && transactions.length < limit; i++) {
        try {
          const blockHeight = latestHeight - i;
          const blockResponse = await axios.get(`${this.baseUrl}/block-height/${blockHeight}`, {
            timeout: 10000
          });
          
          if (!blockResponse.data) continue;
          
          const blockHash = blockResponse.data;
          const blockTxsResponse = await axios.get(`${this.baseUrl}/block/${blockHash}/txs`, {
            timeout: 10000
          });
          
          if (!blockTxsResponse.data || !Array.isArray(blockTxsResponse.data)) continue;
          
          for (const tx of blockTxsResponse.data) {
            if (transactions.length >= limit) break;
            
            try {
              // 计算交易总输出值
              let totalOutput = 0;
              if (tx.vout && Array.isArray(tx.vout)) {
                for (const output of tx.vout) {
                  if (output.value) {
                    totalOutput += output.value;
                  }
                }
              }
              
              // 转换为BTC (satoshi to BTC)
              const btcValue = totalOutput / 100000000;
              
              if (btcValue >= minValue) {
                // 获取输入和输出地址
                let fromAddress = 'Unknown';
                let toAddress = 'Unknown';
                
                if (tx.vin && tx.vin.length > 0 && tx.vin[0].prevout && tx.vin[0].prevout.scriptpubkey_address) {
                  fromAddress = tx.vin[0].prevout.scriptpubkey_address;
                }
                
                if (tx.vout && tx.vout.length > 0 && tx.vout[0].scriptpubkey_address) {
                  toAddress = tx.vout[0].scriptpubkey_address;
                }
                
                transactions.push({
                  hash: tx.txid,
                  from: fromAddress,
                  to: toAddress,
                  value: btcValue,
                  timestamp: tx.status?.block_time || Math.floor(Date.now() / 1000),
                  blockNumber: blockHeight
                });
              }
            } catch (txError) {
              continue;
            }
          }
        } catch (blockError) {
          continue;
        }
      }
      
      return transactions;
    } catch (error) {
      const err = error as Error;
      console.error(`获取比特币大额转账失败: ${err.message}`);
      return [];
    }
  }

  /**
   * 获取账户余额
   * @param address 比特币地址
   */
  async getAccountBalance(address: string): Promise<{
    btcBalance: string;
    usdValue?: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/address/${address}`, {
        timeout: 10000
      });
      
      if (response.data && response.data.chain_stats) {
        const satoshiBalance = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
        const btcBalance = satoshiBalance / 100000000;
        
        return {
          btcBalance: btcBalance.toString()
        };
      }
      
      throw new Error('无法获取余额信息');
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取比特币账户余额失败: ${err.message}`);
    }
  }

  /**
   * 获取最新区块信息
   */
  async getLatestBlockInfo(): Promise<{
    number: number;
    timestamp: number;
    hash: string;
    transactions: number;
  }> {
    try {
      const heightResponse = await axios.get(`${this.baseUrl}/blocks/tip/height`, {
        timeout: 10000
      });
      
      if (!heightResponse.data) {
        throw new Error('无法获取最新区块高度');
      }
      
      const height = heightResponse.data;
      const blockResponse = await axios.get(`${this.baseUrl}/block-height/${height}`, {
        timeout: 10000
      });
      
      if (!blockResponse.data) {
        throw new Error('无法获取区块哈希');
      }
      
      const blockHash = blockResponse.data;
      const blockInfoResponse = await axios.get(`${this.baseUrl}/block/${blockHash}`, {
        timeout: 10000
      });
      
      if (!blockInfoResponse.data) {
        throw new Error('无法获取区块信息');
      }
      
      const blockInfo = blockInfoResponse.data;
      
      return {
        number: height,
        timestamp: blockInfo.timestamp * 1000, // 转换为毫秒
        hash: blockHash,
        transactions: blockInfo.tx_count || 0
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取比特币区块信息失败: ${err.message}`);
    }
  }
}

export default new BitcoinAPI();
