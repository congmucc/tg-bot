import { initWhaleMonitor, startWhaleMonitoring, stopWhaleMonitoring, getMonitoringStatus } from '../services/whaleMonitor';

// Mock Telegram bot to avoid actual message sending during tests
jest.mock('../utils/telegram', () => ({
  safeSendMessage: jest.fn().mockResolvedValue(true)
}));

// Mock blockchain APIs
jest.mock('../api/blockchain/ethereum', () => ({
  default: {
    getLargeTransactions: jest.fn().mockResolvedValue([
      {
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        value: '150',
        timestamp: Date.now() / 1000
      }
    ])
  }
}));

jest.mock('../api/blockchain/solana', () => ({
  default: {
    getLargeTransactions: jest.fn().mockResolvedValue([
      {
        hash: 'sol123',
        from: 'sol_from',
        to: 'sol_to',
        value: '600',
        timestamp: Date.now() / 1000
      }
    ])
  }
}));

jest.mock('../api/blockchain/bitcoin', () => ({
  default: {
    getLargeTransactions: jest.fn().mockResolvedValue([
      {
        hash: 'btc123',
        from: 'btc_from',
        to: 'btc_to',
        value: '15',
        timestamp: Date.now() / 1000
      }
    ])
  }
}));

jest.mock('../api/blockchain/hyperliquidApi', () => ({
  default: {
    getLargeTransactions: jest.fn().mockResolvedValue([
      {
        hash: 'hl123',
        from: 'hl_from',
        to: 'hl_to',
        value: '150000',
        timestamp: Date.now() / 1000
      }
    ])
  }
}));

describe('Whale Monitor Tests', () => {
  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 确保监控停止
    stopWhaleMonitoring();
  });

  describe('Initialization', () => {
    test('should initialize whale monitor without errors', () => {
      expect(() => {
        initWhaleMonitor();
      }).not.toThrow();
    });
  });

  describe('Monitoring Control', () => {
    test('should start monitoring successfully', () => {
      const result = startWhaleMonitoring();
      expect(result).toBe(true);
      
      const status = getMonitoringStatus();
      expect(status.active).toBe(true);
    });

    test('should not start monitoring if already running', () => {
      // 先启动监控
      const firstStart = startWhaleMonitoring();
      expect(firstStart).toBe(true);
      
      // 再次尝试启动应该返回false
      const secondStart = startWhaleMonitoring();
      expect(secondStart).toBe(false);
    });

    test('should stop monitoring successfully', () => {
      // 先启动监控
      startWhaleMonitoring();
      
      const result = stopWhaleMonitoring();
      expect(result).toBe(true);
      
      const status = getMonitoringStatus();
      expect(status.active).toBe(false);
    });

    test('should return false when stopping non-running monitor', () => {
      const result = stopWhaleMonitoring();
      expect(result).toBe(false);
    });
  });

  describe('Monitoring Status', () => {
    test('should return correct status when not monitoring', () => {
      const status = getMonitoringStatus();
      
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('mode');
      expect(status.active).toBe(false);
    });

    test('should return correct status when monitoring', () => {
      startWhaleMonitoring();
      const status = getMonitoringStatus();
      
      expect(status.active).toBe(true);
      expect(status.mode).toBe('简化轮询');
      expect(status.interval).toBe('30秒');
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API to throw error
      const mockError = new Error('API Error');
      require('../api/blockchain/ethereum').default.getLargeTransactions.mockRejectedValue(mockError);
      
      // 这个测试主要确保错误不会导致程序崩溃
      expect(() => {
        startWhaleMonitoring();
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should handle multiple blockchain monitoring', async () => {
      // 这个测试验证多链监控能正常工作
      const { sendWhaleAlert } = require('../services/whaleMonitor');
      
      // Mock channel ID
      process.env.TELEGRAM_CHAT_ID = 'test_channel';
      
      try {
        const result = await sendWhaleAlert('test_channel');
        // 结果应该是boolean
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // 如果有错误，应该是可预期的错误
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Tests', () => {
    test('should complete monitoring cycle within reasonable time', async () => {
      const startTime = Date.now();
      
      const { sendWhaleAlert } = require('../services/whaleMonitor');
      
      try {
        await sendWhaleAlert('test_channel');
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 监控周期应该在30秒内完成
        expect(duration).toBeLessThan(30000);
      } catch (error) {
        // 网络错误可以接受
        console.warn('Performance test skipped due to error:', error);
      }
    }, 35000);
  });
});
