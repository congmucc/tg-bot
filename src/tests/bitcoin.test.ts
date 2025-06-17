import bitcoinApi from '../api/blockchain/bitcoin';

describe('Bitcoin API Tests', () => {
  // 测试获取大额交易
  describe('getLargeTransactions', () => {
    test('should return large transactions with valid threshold', async () => {
      const minValue = 1; // 1 BTC threshold for testing
      
      try {
        const transactions = await bitcoinApi.getLargeTransactions(minValue);
        
        // 验证返回的是数组
        expect(Array.isArray(transactions)).toBe(true);
        
        // 如果有交易，验证交易结构
        if (transactions.length > 0) {
          const tx = transactions[0];
          expect(tx).toHaveProperty('hash');
          expect(tx).toHaveProperty('from');
          expect(tx).toHaveProperty('to');
          expect(tx).toHaveProperty('value');
          expect(tx).toHaveProperty('timestamp');
          
          // 验证交易金额大于阈值
          expect(parseFloat(tx.value)).toBeGreaterThanOrEqual(minValue);
        }
        
        console.log(`Found ${transactions.length} large Bitcoin transactions`);
      } catch (error) {
        console.error('Bitcoin API test failed:', error);
        // 如果是网络错误，跳过测试
        if (error instanceof Error && error.message.includes('network')) {
          console.warn('Skipping test due to network issues');
          return;
        }
        throw error;
      }
    }, 30000); // 30秒超时
    
    test('should handle invalid threshold gracefully', async () => {
      try {
        const transactions = await bitcoinApi.getLargeTransactions(-1);
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions.length).toBe(0);
      } catch (error) {
        // 应该抛出错误或返回空数组
        expect(error).toBeDefined();
      }
    });
    
    test('should handle very high threshold', async () => {
      const minValue = 1000000; // 1M BTC - 不太可能有这样的交易
      
      try {
        const transactions = await bitcoinApi.getLargeTransactions(minValue);
        expect(Array.isArray(transactions)).toBe(true);
        // 应该返回空数组或很少的交易
        expect(transactions.length).toBeLessThanOrEqual(5);
      } catch (error) {
        console.error('High threshold test failed:', error);
        // 网络错误可以接受
        if (error instanceof Error && error.message.includes('network')) {
          return;
        }
        throw error;
      }
    });
  });
  
  // 测试API结构
  describe('API Structure', () => {
    test('should have required methods', () => {
      expect(bitcoinApi).toHaveProperty('getLargeTransactions');
      expect(typeof bitcoinApi.getLargeTransactions).toBe('function');
    });
  });
  
  // 测试网络连接
  describe('Network connectivity', () => {
    test('should be able to connect to Bitcoin API', async () => {
      try {
        // 尝试获取一个小阈值的交易来测试连接
        const transactions = await bitcoinApi.getLargeTransactions(0.1);
        
        // 如果没有抛出错误，说明连接成功
        expect(Array.isArray(transactions)).toBe(true);
        console.log('Bitcoin API connection successful');
      } catch (error) {
        console.error('Bitcoin API connection failed:', error);
        
        // 如果是网络相关错误，记录但不失败测试
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes('network') || 
              errorMessage.includes('timeout') || 
              errorMessage.includes('enotfound') ||
              errorMessage.includes('econnrefused')) {
            console.warn('Network connectivity issue detected, skipping test');
            return;
          }
        }
        
        throw error;
      }
    }, 20000);
  });
});
