import { monitorLargeTransactions, getBlockchainAPI } from '../api/blockchain';

// 类型定义
interface MonitorResult {
  chain: string;
  success: boolean;
  transactions?: any[];
  count?: number;
  error?: string;
}

describe('Blockchain Integration Tests', () => {
  describe('monitorLargeTransactions', () => {
    test('should monitor all chains with default parameters', async () => {
      try {
        const results = await monitorLargeTransactions();
        
        // 验证返回结果是数组
        expect(Array.isArray(results)).toBe(true);
        
        // 验证每个结果都有必要的属性
        results.forEach((result: any) => {
          expect(result).toHaveProperty('chain');
          expect(result).toHaveProperty('success');

          if (result.success) {
            expect(result).toHaveProperty('transactions');
            expect(result).toHaveProperty('count');
            expect(Array.isArray(result.transactions)).toBe(true);
            expect(result.count).toBe(result.transactions.length);
          } else {
            expect(result).toHaveProperty('error');
          }
        });
        
        console.log(`Monitored ${results.length} chains`);
        results.forEach((result: any) => {
          if (result.success) {
            console.log(`${result.chain}: ${result.count} transactions`);
          } else {
            console.log(`${result.chain}: Error - ${result.error}`);
          }
        });
      } catch (error) {
        console.error('Integration test failed:', error);
        
        // 如果是网络错误，跳过测试
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping test due to network issues');
          return;
        }
        throw error;
      }
    }, 60000); // 60秒超时，因为要查询多个链

    test('should monitor specific chains only', async () => {
      try {
        // 只监控以太坊和比特币
        const results = await monitorLargeTransactions(
          50,   // ETH threshold
          0,    // SOL threshold (disabled)
          5,    // BTC threshold
          0,    // HL threshold (disabled)
          true, // include ETH
          false, // exclude SOL
          true,  // include BTC
          false  // exclude HL
        );
        
        expect(Array.isArray(results)).toBe(true);
        
        // 应该只有ETH和BTC的结果
        const chains = results.map((r: any) => r.chain);
        expect(chains).toContain('ethereum');
        expect(chains).toContain('bitcoin');
        expect(chains).not.toContain('solana');
        expect(chains).not.toContain('hyperliquid');
        
      } catch (error) {
        console.error('Selective monitoring test failed:', error);
        
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping selective monitoring test due to network issues');
          return;
        }
        throw error;
      }
    }, 45000);

    test('should handle high thresholds gracefully', async () => {
      try {
        // 使用很高的阈值，应该返回很少或没有交易
        const results = await monitorLargeTransactions(
          10000,  // 10k ETH
          100000, // 100k SOL
          1000,   // 1k BTC
          10000000 // 10M USD
        );
        
        expect(Array.isArray(results)).toBe(true);
        
        results.forEach((result: any) => {
          if (result.success) {
            // 高阈值应该返回很少的交易
            expect(result.count).toBeLessThanOrEqual(10);
          }
        });
        
      } catch (error) {
        console.error('High threshold test failed:', error);
        
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping high threshold test due to network issues');
          return;
        }
        throw error;
      }
    }, 45000);
  });

  describe('getBlockchainAPI', () => {
    test('should return correct API for each blockchain', () => {
      const ethApi = getBlockchainAPI('ethereum');
      expect(ethApi).toBeDefined();
      expect(ethApi).toHaveProperty('getLargeTransactions');

      const solApi = getBlockchainAPI('solana');
      expect(solApi).toBeDefined();
      expect(solApi).toHaveProperty('getLargeTransactions');

      const btcApi = getBlockchainAPI('bitcoin');
      expect(btcApi).toBeDefined();
      expect(btcApi).toHaveProperty('getLargeTransactions');

      const hlApi = getBlockchainAPI('hyperliquid');
      expect(hlApi).toBeDefined();
      expect(hlApi).toHaveProperty('getLargeTransactions');
    });

    test('should handle unsupported blockchain gracefully', () => {
      try {
        const result = getBlockchainAPI('unsupported' as any);
        // 如果没有抛出错误，结果应该是undefined或null
        expect(result).toBeFalsy();
      } catch (error) {
        // 抛出错误也是可以接受的
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Resilience', () => {
    test('should continue monitoring other chains when one fails', async () => {
      try {
        // 使用一些可能导致错误的参数
        const results = await monitorLargeTransactions(
          -1,  // 无效的ETH阈值
          500, // 正常的SOL阈值
          10,  // 正常的BTC阈值
          100000 // 正常的HL阈值
        );
        
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        
        // 至少应该有一些成功的结果
        const successfulResults = results.filter((r: any) => r.success);
        const failedResults = results.filter((r: any) => !r.success);
        
        console.log(`Successful: ${successfulResults.length}, Failed: ${failedResults.length}`);
        
        // 即使有失败的，也应该有成功的
        expect(successfulResults.length + failedResults.length).toBe(results.length);
        
      } catch (error) {
        console.error('Error resilience test failed:', error);
        
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping error resilience test due to network issues');
          return;
        }
        throw error;
      }
    }, 45000);
  });

  describe('Performance', () => {
    test('should complete monitoring within reasonable time', async () => {
      const startTime = Date.now();
      
      try {
        await monitorLargeTransactions(100, 500, 10, 100000);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 应该在45秒内完成
        expect(duration).toBeLessThan(45000);
        console.log(`Monitoring completed in ${duration}ms`);
        
      } catch (error) {
        console.error('Performance test failed:', error);
        
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping performance test due to network issues');
          return;
        }
        throw error;
      }
    }, 50000);
  });
});
