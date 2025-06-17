import { ethers } from 'ethers';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { API_CONFIG, API_KEYS } from '../../config/env';

// 加载环境变量
dotenv.config();

// ERC20 代币 ABI (简化版)
const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

/**
 * 以太坊区块链接口实现
 */
class EthereumAPI {
  public provider: ethers.providers.JsonRpcProvider;
  public etherscanApiKey: string;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(API_CONFIG.ETHEREUM_RPC_URL);
    this.etherscanApiKey = API_KEYS.ETHERSCAN_API_KEY || '';
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
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);
      
      return {
        name,
        symbol,
        decimals,
        totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取代币信息失败: ${err.message}`);
    }
  }

  /**
   * 获取账户余额
   * @param address 账户地址
   */
  async getAccountBalance(address: string): Promise<{
    ethBalance: string;
    usdValue?: number;
  }> {
    try {
      const balance = await this.provider.getBalance(address);
      return {
        ethBalance: ethers.utils.formatEther(balance)
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取以太坊账户余额失败: ${err.message}`);
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
      // ERC20代币ABI
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      // 创建合约实例
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);

      // 获取代币信息
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      return {
        tokenSymbol: symbol,
        balance: ethers.utils.formatUnits(balance, decimals),
        decimals
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取以太坊代币余额失败: ${err.message}`);
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
      const block = await this.provider.getBlock('latest');
      
      return {
        number: block.number,
        timestamp: block.timestamp * 1000, // 转换为毫秒
        hash: block.hash,
        transactions: block.transactions.length
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取以太坊区块信息失败: ${err.message}`);
    }
  }

  /**
   * 获取大额转账
   * @param minValue 最小ETH价值
   * @param page 页码
   * @param offset 每页数量
   */
  async getLargeTransactions(minValue = 100, page = 1, offset = 10): Promise<any> {
    try {
      // 首先尝试使用Etherscan API
      try {
        if (!this.etherscanApiKey) {
          throw new Error('未配置Etherscan API密钥');
        }

        console.log("尝试使用Etherscan API获取以太坊大额交易...");
        const response = await axios.get('https://api.etherscan.io/api', {
          params: {
            module: 'account',
            action: 'txlist',
            sort: 'desc',
            page,
            offset,
            apikey: this.etherscanApiKey
          },
          timeout: 10000
        });

        if (response.data && response.data.status === '1' && response.data.result) {
          // 过滤大额交易
          const minValueInWei = ethers.utils.parseEther(minValue.toString());
          const largeTransactions = response.data.result
            .filter((tx: any) => {
              return ethers.BigNumber.from(tx.value).gte(minValueInWei);
            })
            .map((tx: any) => ({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: ethers.utils.formatEther(tx.value),
              timestamp: parseInt(tx.timeStamp),
              blockNumber: parseInt(tx.blockNumber)
            }));

          if (largeTransactions.length > 0) {
            return largeTransactions;
          }
        }
      } catch (etherscanError) {
        console.log(`Etherscan API调用失败，尝试备用方法: ${(etherscanError as Error).message}`);
      }

      // 如果Etherscan失败，尝试使用RPC方法
      console.log("Etherscan API不可用，尝试使用RPC方法...");

      // 最后从RPC节点直接获取最近区块的大交易
      try {
        console.log("尝试从RPC节点获取以太坊大额交易...");
        const latestBlockNumber = await this.provider.getBlockNumber();
        const transactions = [];
        
        // 获取最近的10个区块
        for (let i = 0; i < 3; i++) {
          const blockNumber = latestBlockNumber - i;
          const block = await this.provider.getBlockWithTransactions(blockNumber);
          
          if (!block || !block.transactions) continue;
          
          // 查找大额交易
          const minValueInWei = ethers.utils.parseEther(minValue.toString());
          
          for (const tx of block.transactions) {
            if (ethers.BigNumber.from(tx.value).gte(minValueInWei)) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || 'Contract Creation',
                value: ethers.utils.formatEther(tx.value),
                timestamp: block.timestamp,
                blockNumber: block.number
              });
              
              if (transactions.length >= offset) {
                break;
              }
            }
          }
          
          if (transactions.length >= offset) {
            break;
          }
        }
        
        if (transactions.length > 0) {
          return transactions;
        }
      } catch (rpcError) {
        console.warn(`从RPC获取区块交易失败: ${(rpcError as Error).message}`);
      }
      
      // 如果所有API都失败，返回空数组而不是抛出错误
      console.log('所有以太坊API尝试均失败，但不影响程序运行');
      return [];
    } catch (error) {
      const err = error as Error;
      console.error(`获取以太坊大额转账失败: ${err.message}`);
      return []; // 返回空数组而不是抛出错误
    }
  }
}

export default new EthereumAPI(); 