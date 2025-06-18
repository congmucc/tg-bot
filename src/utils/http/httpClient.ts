import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * HTTP请求方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * HTTP请求选项接口
 */
export interface HttpRequestOptions extends AxiosRequestConfig {
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟(毫秒)
  timeout?: number; // 超时时间(毫秒)
  _retryCount?: number; // 内部使用，当前重试次数
}

/**
 * HTTP请求响应接口
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: HttpRequestOptions;
}

/**
 * HTTP客户端类
 * 封装了基本的HTTP请求功能，提供统一的错误处理和重试机制
 */
class HttpClient {
  public instance: AxiosInstance;
  public defaultOptions: HttpRequestOptions = {
    timeout: 60000, // 默认60秒超时，大幅增加超时时间
    retry: 3, // 默认重试3次，增加重试次数
    retryDelay: 3000, // 默认重试延迟3秒，增加延迟
  };
  
  // 添加请求限流控制
  public requestQueue: Map<string, {
    timestamp: number,
    count: number
  }> = new Map();
  public maxRequestsPerSecond = 1; // 每秒最大请求数，降低到1
  public minRequestInterval = 1000; // 最小请求间隔(毫秒)，增加到1秒
  public lastRequestTime = 0; // 上次请求时间
  
  // 429错误处理
  public rateLimitedHosts: Map<string, {
    retryAfter: number,
    nextAllowedTime: number
  }> = new Map();
  
  // 日志控制
  public logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug' = 'error'; // 默认只显示错误

  /**
   * 构造函数
   * @param baseURL 基础URL
   * @param options 默认请求选项
   */
  constructor(baseURL?: string, options?: HttpRequestOptions) {
    this.instance = axios.create({
      baseURL,
      ...this.defaultOptions,
      ...options,
    });

    // 添加请求拦截器
    this.instance.interceptors.request.use(
      async (config) => {
        // 在发送请求之前做些什么
        const url = config.url || '';
        const host = this.extractHost(config.baseURL || '', url);
        
        // 检查是否被限流
        const rateLimitInfo = this.rateLimitedHosts.get(host);
        if (rateLimitInfo && Date.now() < rateLimitInfo.nextAllowedTime) {
          const waitTime = rateLimitInfo.nextAllowedTime - Date.now();
          if (this.logLevel !== 'none') {
            console.log(`[HTTP] 主机 ${host} 被限流，等待 ${waitTime}ms 后重试`);
          }
          await this.delay(waitTime);
        }
        
        // 强制请求间隔
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
          await this.delay(this.minRequestInterval - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();
        
        // 实现简单的请求限流
        if (this.shouldThrottle(url)) {
          await this.delay(2000); // 延迟2秒，增加延迟时间
        }
        
        // 记录请求
        this.recordRequest(url);
        
        // 只在非重试请求时打印日志，且仅在debug级别
        const httpConfig = config as HttpRequestOptions;
        if (this.logLevel === 'debug' && (!httpConfig._retryCount || httpConfig._retryCount === 0)) {
          const fullUrl = this.buildFullUrl(url, config);
          console.log(`[HTTP] 请求: ${config.method?.toUpperCase()} ${fullUrl}`);
        }
        
        return config;
      },
      (error) => {
        // 对请求错误做些什么
        if (this.logLevel !== 'none') {
        console.error(`[HTTP] 请求错误:`, error);
        }
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        // 对响应数据做点什么，只在debug级别打印
        if (this.logLevel === 'debug') {
        console.log(`[HTTP] 响应: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        // 对响应错误做点什么
        const config = error.config as HttpRequestOptions;
        
        // 处理429错误 (Too Many Requests)
        if (error.response && error.response.status === 429) {
          const host = this.extractHost(config.baseURL || '', config.url || '');
          
          // 获取Retry-After头
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          const retryAfterMs = retryAfter * 1000;
          
          // 记录限流信息
          this.rateLimitedHosts.set(host, {
            retryAfter: retryAfterMs,
            nextAllowedTime: Date.now() + retryAfterMs
          });
          
          if (this.logLevel !== 'none') {
            console.warn(`[HTTP] 请求被限流 (429): ${host}, 将在 ${retryAfter} 秒后重试`);
          }
          
          // 等待指定的时间
          await this.delay(retryAfterMs);
          
          // 重试请求
          return this.instance(config);
        }
        
        // 如果没有配置重试，直接返回错误
        if (!config || !config.retry) {
          if (this.logLevel !== 'none') {
            console.error(`[HTTP] 请求失败: ${error.message}`);
          }
          return Promise.reject(error);
        }
        
        // 设置当前重试次数
        config._retryCount = config._retryCount || 0;
        
        // 如果当前重试次数小于最大重试次数，进行重试
        if (config._retryCount < config.retry) {
          config._retryCount += 1;
          
          // 只在第一次重试且warn级别以上时打印日志，避免日志过多
          if (config._retryCount === 1 && this.logLevel !== 'none' && this.logLevel !== 'error') {
          console.log(`[HTTP] 重试请求 (${config._retryCount}/${config.retry}): ${config.url}`);
          }
          
          // 创建延迟Promise，增加重试延迟时间
          const retryDelay = config.retryDelay || this.defaultOptions.retryDelay || 2000;
          await this.delay(retryDelay * config._retryCount * 1.5); // 随着重试次数增加延迟，并增加1.5倍系数
          
          return this.instance(config);
        }
        
        if (this.logLevel !== 'none') {
        console.error(`[HTTP] 请求失败: ${error.message}`, error.response?.data);
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * 提取主机名
   * @param baseURL 基础URL
   * @param path 路径
   * @returns 主机名
   */
  private extractHost(baseURL: string, path: string): string {
    try {
      const url = new URL(path, baseURL);
      return url.hostname;
    } catch (e) {
      return baseURL || 'unknown-host';
    }
  }
  
  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 记录请求
   * @param url 请求URL
   */
  private recordRequest(url: string): void {
    const now = Date.now();
    const key = url.split('?')[0]; // 忽略查询参数
    
    const record = this.requestQueue.get(key) || { timestamp: now, count: 0 };
    
    // 如果记录是1秒前的，重置计数
    if (now - record.timestamp > 1000) {
      record.timestamp = now;
      record.count = 1;
    } else {
      record.count++;
    }
    
    this.requestQueue.set(key, record);
  }
  
  /**
   * 检查是否应该限流
   * @param url 请求URL
   * @returns 是否应该限流
   */
  private shouldThrottle(url: string): boolean {
    const key = url.split('?')[0]; // 忽略查询参数
    const record = this.requestQueue.get(key);
    
    if (!record) return false;
    
    const now = Date.now();
    
    // 如果记录是1秒内的，且请求次数超过限制
    if (now - record.timestamp <= 1000 && record.count >= this.maxRequestsPerSecond) {
      return true;
    }
    
    return false;
  }



  /**
   * 发送GET请求
   * @param url 请求URL
   * @param options 请求选项 (包含params查询参数)
   * @returns 请求响应
   */
  public async get<T = any>(
    url: string,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const config: HttpRequestOptions = {
      ...options,
      method: 'GET',
      url,
    };

    // GET请求的参数放在params中
    if (options?.params) {
      config.params = options.params;
    }

    const response = await this.instance.request<T>(config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config as HttpRequestOptions,
    };
  }

  /**
   * 发送POST请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param options 请求选项
   * @returns 请求响应
   */
  public async post<T = any>(
    url: string,
    data?: any,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const config: HttpRequestOptions = {
      ...options,
      method: 'POST',
      url,
      data, // POST请求的数据放在body中
    };

    const response = await this.instance.request<T>(config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config as HttpRequestOptions,
    };
  }

  /**
   * 发送PUT请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param options 请求选项
   * @returns 请求响应
   */
  public async put<T = any>(
    url: string,
    data?: any,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const config: HttpRequestOptions = {
      ...options,
      method: 'PUT',
      url,
      data, // PUT请求的数据放在body中
    };

    const response = await this.instance.request<T>(config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config as HttpRequestOptions,
    };
  }

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param options 请求选项 (包含params查询参数)
   * @returns 请求响应
   */
  public async delete<T = any>(
    url: string,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const config: HttpRequestOptions = {
      ...options,
      method: 'DELETE',
      url,
    };

    // DELETE请求的参数放在params中
    if (options?.params) {
      config.params = options.params;
    }

    const response = await this.instance.request<T>(config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config as HttpRequestOptions,
    };
  }

  /**
   * 创建HTTP客户端实例
   * @param baseURL 基础URL
   * @param options 请求选项
   * @returns HTTP客户端实例
   */
  public static create(baseURL?: string, options?: HttpRequestOptions): HttpClient {
    return new HttpClient(baseURL, options);
  }
  
  /**
   * 设置日志级别
   * @param level 日志级别
   */
  public setLogLevel(level: 'none' | 'error' | 'warn' | 'info' | 'debug'): void {
    this.logLevel = level;
  }

  /**
   * 构建完整URL用于日志记录
   * @param url 请求URL
   * @param config 请求配置
   * @returns 完整URL
   */
  private buildFullUrl(url: string, config: AxiosRequestConfig): string {
    try {
      let fullUrl = url;

      // 如果有baseURL，构建完整URL
      if (this.instance.defaults.baseURL && !url.startsWith('http')) {
        fullUrl = `${this.instance.defaults.baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
      }

      // 添加查询参数
      if (config.params) {
        const searchParams = new URLSearchParams();
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
        }
      }

      return fullUrl;
    } catch (error) {
      return url; // 如果构建失败，返回原始URL
    }
  }
}

// 导出默认实例
export default HttpClient; 