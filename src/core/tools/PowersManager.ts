/**
 * PowersManager - Kiro Powers 管理器
 * 
 * 实现 list、activate、use、readSteering、configure 方法
 * 
 * Requirements: 9.1-9.7
 */

import { Power, PowerTool, PowerConfig } from '../types/unified-agent';

// Power 状态
export type PowerStatus = 'installed' | 'active' | 'disabled' | 'error';

// Power 信息
export interface PowerInfo {
  name: string;
  displayName: string;
  description: string;
  keywords: string[];
  status: PowerStatus;
  mcpServers: string[];
  steeringFiles: string[];
}

// Power 激活结果
export interface ActivateResult {
  powerName: string;
  displayName: string;
  keywords: string[];
  description: string;
  overview: string;
  toolsByServer: Record<string, PowerTool[]>;
  steeringFiles: string[];
  powerMdFound: boolean;
}

// Power 使用结果
export interface UseResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Power 存储接口（用于依赖注入）
export interface PowerStorage {
  listPowers(): Promise<PowerInfo[]>;
  getPower(name: string): Promise<Power | null>;
  getPowerMd(name: string): Promise<string | null>;
  getSteeringFile(powerName: string, fileName: string): Promise<string | null>;
  savePowerConfig(name: string, config: PowerConfig): Promise<void>;
}

// MCP 客户端接口（用于依赖注入）
export interface MCPClient {
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
  getServerTools(serverName: string): Promise<PowerTool[]>;
}

// Mock Power 存储（用于测试）
export class MockPowerStorage implements PowerStorage {
  private powers: Map<string, Power> = new Map();
  private powerMds: Map<string, string> = new Map();
  private steeringFiles: Map<string, string> = new Map();
  private configs: Map<string, PowerConfig> = new Map();
  
  setPower(power: Power): void {
    this.powers.set(power.name, power);
  }
  
  setPowerMd(name: string, content: string): void {
    this.powerMds.set(name, content);
  }
  
  setSteeringFile(powerName: string, fileName: string, content: string): void {
    this.steeringFiles.set(`${powerName}:${fileName}`, content);
  }
  
  async listPowers(): Promise<PowerInfo[]> {
    return Array.from(this.powers.values()).map(p => ({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      keywords: p.keywords,
      status: p.disabled ? 'disabled' : 'installed',
      mcpServers: p.mcpServers.map(s => s.name),
      steeringFiles: p.steeringFiles
    }));
  }
  
  async getPower(name: string): Promise<Power | null> {
    return this.powers.get(name) ?? null;
  }
  
  async getPowerMd(name: string): Promise<string | null> {
    return this.powerMds.get(name) ?? null;
  }
  
  async getSteeringFile(powerName: string, fileName: string): Promise<string | null> {
    return this.steeringFiles.get(`${powerName}:${fileName}`) ?? null;
  }
  
  async savePowerConfig(name: string, config: PowerConfig): Promise<void> {
    this.configs.set(name, config);
  }
  
  getConfig(name: string): PowerConfig | undefined {
    return this.configs.get(name);
  }
}

// Mock MCP 客户端（用于测试）
export class MockMCPClient implements MCPClient {
  private toolResults: Map<string, unknown> = new Map();
  private serverTools: Map<string, PowerTool[]> = new Map();
  
  setToolResult(serverName: string, toolName: string, result: unknown): void {
    this.toolResults.set(`${serverName}:${toolName}`, result);
  }
  
  setServerTools(serverName: string, tools: PowerTool[]): void {
    this.serverTools.set(serverName, tools);
  }
  
  async callTool(serverName: string, toolName: string, _args: Record<string, unknown>): Promise<unknown> {
    const result = this.toolResults.get(`${serverName}:${toolName}`);
    if (result === undefined) {
      throw new Error(`Tool not found: ${serverName}/${toolName}`);
    }
    return result;
  }
  
  async getServerTools(serverName: string): Promise<PowerTool[]> {
    return this.serverTools.get(serverName) ?? [];
  }
}

/**
 * PowersManager 类
 */
export class PowersManager {
  private storage: PowerStorage;
  private mcpClient: MCPClient;
  private activePowers: Set<string> = new Set();
  
  constructor(storage: PowerStorage, mcpClient: MCPClient) {
    this.storage = storage;
    this.mcpClient = mcpClient;
  }
  
  /**
   * 列出所有已安装的 Powers
   * Requirements: 9.1
   */
  async list(): Promise<PowerInfo[]> {
    const powers = await this.storage.listPowers();
    
    // 更新活跃状态
    return powers.map(p => ({
      ...p,
      status: this.activePowers.has(p.name) ? 'active' : p.status
    }));
  }
  
  /**
   * 激活 Power
   * Requirements: 9.2
   */
  async activate(powerName: string): Promise<ActivateResult> {
    const power = await this.storage.getPower(powerName);
    
    if (!power) {
      throw new Error(`Power not found: ${powerName}`);
    }
    
    if (power.disabled) {
      throw new Error(`Power is disabled: ${powerName}`);
    }
    
    // 获取 POWER.md 内容
    const powerMd = await this.storage.getPowerMd(powerName);
    
    // 获取所有服务器的工具
    const toolsByServer: Record<string, PowerTool[]> = {};
    
    for (const server of power.mcpServers) {
      const tools = await this.mcpClient.getServerTools(server.name);
      toolsByServer[server.name] = tools;
    }
    
    // 标记为活跃
    this.activePowers.add(powerName);
    
    return {
      powerName: power.name,
      displayName: power.displayName,
      keywords: power.keywords,
      description: power.description,
      overview: powerMd ?? '',
      toolsByServer,
      steeringFiles: power.steeringFiles,
      powerMdFound: powerMd !== null
    };
  }
  
  /**
   * 使用 Power 工具
   * Requirements: 9.3
   */
  async use(
    powerName: string,
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<UseResult> {
    // 检查 Power 是否已激活
    if (!this.activePowers.has(powerName)) {
      return {
        success: false,
        error: `Power not activated: ${powerName}. Call activate() first.`
      };
    }
    
    const power = await this.storage.getPower(powerName);
    
    if (!power) {
      return {
        success: false,
        error: `Power not found: ${powerName}`
      };
    }
    
    // 检查服务器是否属于该 Power
    const server = power.mcpServers.find(s => s.name === serverName);
    if (!server) {
      return {
        success: false,
        error: `Server ${serverName} not found in power ${powerName}`
      };
    }
    
    try {
      const result = await this.mcpClient.callTool(serverName, toolName, args);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 读取 Steering 文件
   * Requirements: 9.4
   */
  async readSteering(powerName: string, steeringFile: string): Promise<string> {
    const power = await this.storage.getPower(powerName);
    
    if (!power) {
      throw new Error(`Power not found: ${powerName}`);
    }
    
    // 检查文件是否在 Power 的 steering 文件列表中
    if (!power.steeringFiles.includes(steeringFile)) {
      throw new Error(`Steering file not found: ${steeringFile} in power ${powerName}`);
    }
    
    const content = await this.storage.getSteeringFile(powerName, steeringFile);
    
    if (content === null) {
      throw new Error(`Failed to read steering file: ${steeringFile}`);
    }
    
    return content;
  }
  
  /**
   * 配置 Power
   * Requirements: 9.5
   */
  async configure(powerName: string, config: Partial<PowerConfig>): Promise<void> {
    const power = await this.storage.getPower(powerName);
    
    if (!power) {
      throw new Error(`Power not found: ${powerName}`);
    }
    
    const fullConfig: PowerConfig = {
      disabled: config.disabled ?? power.disabled,
      autoApprove: config.autoApprove ?? [],
      env: config.env ?? {}
    };
    
    await this.storage.savePowerConfig(powerName, fullConfig);
  }
  
  /**
   * 停用 Power
   * Requirements: 9.6
   */
  deactivate(powerName: string): boolean {
    return this.activePowers.delete(powerName);
  }
  
  /**
   * 检查 Power 是否已激活
   */
  isActive(powerName: string): boolean {
    return this.activePowers.has(powerName);
  }
  
  /**
   * 获取活跃的 Powers 列表
   */
  getActivePowers(): string[] {
    return Array.from(this.activePowers);
  }
  
  /**
   * 根据关键词搜索 Powers
   * Requirements: 9.7
   */
  async searchByKeyword(keyword: string): Promise<PowerInfo[]> {
    const powers = await this.list();
    const lowerKeyword = keyword.toLowerCase();
    
    return powers.filter(p => 
      p.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
      p.name.toLowerCase().includes(lowerKeyword) ||
      p.description.toLowerCase().includes(lowerKeyword)
    );
  }
  
  /**
   * 自动激活匹配关键词的 Powers
   */
  async autoActivateByKeywords(text: string): Promise<string[]> {
    const powers = await this.list();
    const activated: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const power of powers) {
      if (power.status === 'disabled') continue;
      if (this.activePowers.has(power.name)) continue;
      
      const matches = power.keywords.some(k => 
        lowerText.includes(k.toLowerCase())
      );
      
      if (matches) {
        await this.activate(power.name);
        activated.push(power.name);
      }
    }
    
    return activated;
  }
}

export default PowersManager;
