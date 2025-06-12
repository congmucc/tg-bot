import { ethers } from 'ethers';
import axios from 'axios';
import { config } from '../../config';

// ERC20 代币 ABI (简化版)
const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

class EthereumAPI {
  private provider: ethers.providers.JsonRpcProvider;
  private etherscanApiKey: string;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.ETHEREUM_RPC_URL);
    this.etherscanApiKey = config.ETHERSCAN_API_KEY;
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
      throw new Error(`获取账户余额失败: ${err.message}`);
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
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [balance, symbol, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      return {
        tokenSymbol: symbol,
        balance: ethers.utils.formatUnits(balance, decimals),
        decimals
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取代币余额失败: ${err.message}`);
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
      const blockNumber = await this.provider.getBlockNumber();
      const block = await this.provider.getBlock(blockNumber);
      
      return {
        number: block.number,
        timestamp: block.timestamp,
        hash: block.hash,
        transactions: block.transactions.length
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取区块信息失败: ${err.message}`);
    }
  }

  /**
   * 通过Etherscan API获取大额转账
   * @param minValue 最小ETH价值
   * @param page 页码
   * @param offset 每页数量
   */
  async getLargeTransactions(minValue = 100, page = 1, offset = 10): Promise<any> {
    try {
      // 检查API Key是否配置
      if (!this.etherscanApiKey) {
        throw new Error('未配置Etherscan API Key');
      }
      
      const url = `https://api.etherscan.io/api?module=account&action=txlist&sort=desc&apikey=${this.etherscanApiKey}`;
      
      const response = await axios.get(url, {
        params: {
          startblock: 0,
          endblock: 99999999,
          page,
          offset: 100, // 获取更多交易然后过滤
          sort: 'desc'
        }
      });
      
      if (response.data.status !== '1') {
        throw new Error(`Etherscan API调用失败: ${response.data.message}`);
      }
      
      // 过滤大额转账
      const minValueInWei = ethers.utils.parseEther(minValue.toString());
      
      const largeTransactions = response.data.result.filter((tx: any) => 
        ethers.BigNumber.from(tx.value).gte(minValueInWei)
      );
      
      if (largeTransactions.length === 0) {
        throw new Error('未找到符合条件的大额交易');
      }
      
      return largeTransactions.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatEther(tx.value),
        timestamp: tx.timeStamp,
        blockNumber: tx.blockNumber
      }));
    } catch (error) {
      const err = error as Error;
      throw new Error(`获取大额转账失败: ${err.message}`);
    }
  }
}

export default new EthereumAPI(); 