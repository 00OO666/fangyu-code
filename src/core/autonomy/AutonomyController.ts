/**
 * AutonomyController - 自治模式控制器
 * 
 * 实现 Autopilot 和 Supervised 两种自治模式
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

// 自治模式类型
export type AutonomyMode = 'autopilot' | 'supervised';

// 操作类型
export type OperationType = 
  | 'file_create'
  | 'file_modify'
  | 'file_delete'
  | 'command_execute'
  | 'git_commit'
  | 'git_push'
  | 'install_package'
  | 'config_change'
  | 'network_request';

// 操作风险级别
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// 操作记录
export interface OperationRecord {
  id: string;
  type: OperationType;
  description: string;
  timestamp: number;
  riskLevel: RiskLevel;
  reversible: boolean;
  approved: boolean;
  executed: boolean;
  rollbackData?: unknown;
  result?: {
    success: boolean;
    error?: string;
  };
}

// 确认请求
export interface ConfirmationRequest {
  operationId: string;
  type: OperationType;
  description: string;
  riskLevel: RiskLevel;
  details: Record<string, unknown>;
  timeout?: number;
}

// 确认响应
export interface ConfirmationResponse {
  approved: boolean;
  reason?: string;
  modifiedDetails?: Record<string, unknown>;
}

// 自治配置
export interface AutonomyConfig {
  mode: AutonomyMode;
  autoApproveRiskLevels: RiskLevel[];
  requireConfirmationFor: OperationType[];
  maxPendingOperations: number;
  confirmationTimeout: number;
  enableRollback: boolean;
  maxRollbackHistory: number;
}

// 操作风险评估规则
const RISK_RULES: Record<OperationType, RiskLevel> = {
  file_create: 'low',
  file_modify: 'medium',
  file_delete: 'high',
  command_execute: 'high',
  git_commit: 'medium',
  git_push: 'high',
  install_package: 'medium',
  config_change: 'high',
  network_request: 'low',
};


// 危险操作模式
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; riskLevel: RiskLevel }> = [
  { pattern: /rm\s+-rf/i, riskLevel: 'critical' },
  { pattern: /del\s+\/[sq]/i, riskLevel: 'critical' },
  { pattern: /format\s+[a-z]:/i, riskLevel: 'critical' },
  { pattern: /drop\s+database/i, riskLevel: 'critical' },
  { pattern: /truncate\s+table/i, riskLevel: 'critical' },
  { pattern: /git\s+push\s+.*--force/i, riskLevel: 'critical' },
  { pattern: /git\s+reset\s+--hard/i, riskLevel: 'high' },
  { pattern: /npm\s+publish/i, riskLevel: 'high' },
  { pattern: /sudo/i, riskLevel: 'high' },
];

// 确认回调类型
export type ConfirmationCallback = (request: ConfirmationRequest) => Promise<ConfirmationResponse>;

/**
 * AutonomyController 类
 */
export class AutonomyController {
  private mode: AutonomyMode = 'supervised';
  private config: AutonomyConfig;
  private operations: Map<string, OperationRecord> = new Map();
  private rollbackStack: OperationRecord[] = [];
  private confirmationCallback?: ConfirmationCallback;
  private pendingConfirmations: Map<string, {
    resolve: (response: ConfirmationResponse) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config?: Partial<AutonomyConfig>) {
    this.config = {
      mode: config?.mode ?? 'supervised',
      autoApproveRiskLevels: config?.autoApproveRiskLevels ?? ['low'],
      requireConfirmationFor: config?.requireConfirmationFor ?? [
        'file_delete', 'command_execute', 'git_push', 'config_change'
      ],
      maxPendingOperations: config?.maxPendingOperations ?? 10,
      confirmationTimeout: config?.confirmationTimeout ?? 30000,
      enableRollback: config?.enableRollback ?? true,
      maxRollbackHistory: config?.maxRollbackHistory ?? 50,
    };
    this.mode = this.config.mode;
  }

  // ==========================================================================
  // 模式管理
  // ==========================================================================

  /**
   * 获取当前模式
   * Requirements: 11.1
   */
  getMode(): AutonomyMode {
    return this.mode;
  }

  /**
   * 设置自治模式
   * Requirements: 11.1, 11.2
   */
  setMode(mode: AutonomyMode): void {
    this.mode = mode;
    this.config.mode = mode;
  }

  /**
   * 切换模式
   */
  toggleMode(): AutonomyMode {
    this.mode = this.mode === 'autopilot' ? 'supervised' : 'autopilot';
    this.config.mode = this.mode;
    return this.mode;
  }

  /**
   * 检查是否为自动驾驶模式
   */
  isAutopilot(): boolean {
    return this.mode === 'autopilot';
  }

  /**
   * 检查是否为监督模式
   */
  isSupervised(): boolean {
    return this.mode === 'supervised';
  }

  // ==========================================================================
  // 操作管理
  // ==========================================================================

  /**
   * 注册确认回调
   */
  setConfirmationCallback(callback: ConfirmationCallback): void {
    this.confirmationCallback = callback;
  }

  /**
   * 评估操作风险
   * Requirements: 11.3
   */
  assessRisk(type: OperationType, details?: Record<string, unknown>): RiskLevel {
    let baseRisk = RISK_RULES[type] ?? 'medium';
    
    // 检查危险模式
    if (details?.command && typeof details.command === 'string') {
      for (const { pattern, riskLevel } of DANGEROUS_PATTERNS) {
        if (pattern.test(details.command)) {
          if (this.compareRiskLevel(riskLevel, baseRisk) > 0) {
            baseRisk = riskLevel;
          }
        }
      }
    }
    
    // 检查文件路径
    if (details?.path && typeof details.path === 'string') {
      const path = details.path.toLowerCase();
      if (path.includes('config') || path.includes('.env') || path.includes('secret')) {
        if (this.compareRiskLevel('high', baseRisk) > 0) {
          baseRisk = 'high';
        }
      }
    }
    
    return baseRisk;
  }

  /**
   * 比较风险级别
   */
  private compareRiskLevel(a: RiskLevel, b: RiskLevel): number {
    const levels: Record<RiskLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return levels[a] - levels[b];
  }


  /**
   * 请求执行操作
   * Requirements: 11.2, 11.3
   */
  async requestOperation(
    type: OperationType,
    description: string,
    details: Record<string, unknown> = {},
    rollbackData?: unknown
  ): Promise<{ approved: boolean; operationId: string; reason?: string }> {
    const operationId = this.generateId();
    const riskLevel = this.assessRisk(type, details);
    const reversible = rollbackData !== undefined;
    
    const record: OperationRecord = {
      id: operationId,
      type,
      description,
      timestamp: Date.now(),
      riskLevel,
      reversible,
      approved: false,
      executed: false,
      rollbackData,
    };
    
    this.operations.set(operationId, record);
    
    // 自动驾驶模式：自动批准低风险操作
    if (this.mode === 'autopilot') {
      if (this.config.autoApproveRiskLevels.includes(riskLevel)) {
        record.approved = true;
        return { approved: true, operationId };
      }
    }
    
    // 检查是否需要确认
    const needsConfirmation = 
      this.mode === 'supervised' ||
      this.config.requireConfirmationFor.includes(type) ||
      riskLevel === 'critical' ||
      riskLevel === 'high';
    
    if (needsConfirmation) {
      const response = await this.requestConfirmation({
        operationId,
        type,
        description,
        riskLevel,
        details,
        timeout: this.config.confirmationTimeout,
      });
      
      record.approved = response.approved;
      return {
        approved: response.approved,
        operationId,
        reason: response.reason,
      };
    }
    
    // 默认批准
    record.approved = true;
    return { approved: true, operationId };
  }

  /**
   * 请求用户确认
   * Requirements: 11.3
   */
  private async requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationResponse> {
    if (!this.confirmationCallback) {
      // 没有回调，默认拒绝高风险操作
      if (request.riskLevel === 'critical' || request.riskLevel === 'high') {
        return { approved: false, reason: 'No confirmation callback registered' };
      }
      return { approved: true };
    }
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingConfirmations.delete(request.operationId);
        resolve({ approved: false, reason: 'Confirmation timeout' });
      }, request.timeout ?? this.config.confirmationTimeout);
      
      this.pendingConfirmations.set(request.operationId, { resolve, timeout });
      
      this.confirmationCallback!(request)
        .then((response) => {
          clearTimeout(timeout);
          this.pendingConfirmations.delete(request.operationId);
          resolve(response);
        })
        .catch(() => {
          clearTimeout(timeout);
          this.pendingConfirmations.delete(request.operationId);
          resolve({ approved: false, reason: 'Confirmation error' });
        });
    });
  }

  /**
   * 标记操作已执行
   */
  markExecuted(operationId: string, success: boolean, error?: string): void {
    const record = this.operations.get(operationId);
    if (record) {
      record.executed = true;
      record.result = { success, error };
      
      // 添加到回滚栈
      if (success && record.reversible && this.config.enableRollback) {
        this.rollbackStack.push(record);
        
        // 限制回滚历史大小
        while (this.rollbackStack.length > this.config.maxRollbackHistory) {
          this.rollbackStack.shift();
        }
      }
    }
  }

  // ==========================================================================
  // 回滚功能
  // ==========================================================================

  /**
   * 获取可回滚的操作
   * Requirements: 11.4
   */
  getRollbackableOperations(): OperationRecord[] {
    return this.rollbackStack.filter(op => op.reversible && op.executed);
  }

  /**
   * 回滚最近的操作
   * Requirements: 11.4, 11.5
   */
  async rollbackLast(): Promise<{ success: boolean; operation?: OperationRecord; error?: string }> {
    if (!this.config.enableRollback) {
      return { success: false, error: 'Rollback is disabled' };
    }
    
    const operation = this.rollbackStack.pop();
    if (!operation) {
      return { success: false, error: 'No operations to rollback' };
    }
    
    if (!operation.reversible || !operation.rollbackData) {
      return { success: false, error: 'Operation is not reversible', operation };
    }
    
    return { success: true, operation };
  }

  /**
   * 回滚到指定操作
   * Requirements: 11.4
   */
  async rollbackTo(operationId: string): Promise<{
    success: boolean;
    rolledBack: OperationRecord[];
    error?: string;
  }> {
    if (!this.config.enableRollback) {
      return { success: false, rolledBack: [], error: 'Rollback is disabled' };
    }
    
    const index = this.rollbackStack.findIndex(op => op.id === operationId);
    if (index === -1) {
      return { success: false, rolledBack: [], error: 'Operation not found in rollback stack' };
    }
    
    const rolledBack = this.rollbackStack.splice(index);
    return { success: true, rolledBack };
  }

  /**
   * 清除回滚历史
   */
  clearRollbackHistory(): void {
    this.rollbackStack = [];
  }


  // ==========================================================================
  // 操作历史
  // ==========================================================================

  /**
   * 获取操作历史
   */
  getOperationHistory(limit?: number): OperationRecord[] {
    const operations = Array.from(this.operations.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return limit ? operations.slice(0, limit) : operations;
  }

  /**
   * 获取操作记录
   */
  getOperation(operationId: string): OperationRecord | undefined {
    return this.operations.get(operationId);
  }

  /**
   * 获取待处理的操作
   */
  getPendingOperations(): OperationRecord[] {
    return Array.from(this.operations.values())
      .filter(op => op.approved && !op.executed);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    mode: AutonomyMode;
    totalOperations: number;
    approvedOperations: number;
    rejectedOperations: number;
    executedOperations: number;
    rollbackableOperations: number;
    byRiskLevel: Record<RiskLevel, number>;
    byType: Record<OperationType, number>;
  } {
    const operations = Array.from(this.operations.values());
    
    const byRiskLevel: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    const byType: Partial<Record<OperationType, number>> = {};
    
    let approved = 0;
    let rejected = 0;
    let executed = 0;
    
    for (const op of operations) {
      byRiskLevel[op.riskLevel]++;
      byType[op.type] = (byType[op.type] ?? 0) + 1;
      
      if (op.approved) approved++;
      else rejected++;
      
      if (op.executed) executed++;
    }
    
    return {
      mode: this.mode,
      totalOperations: operations.length,
      approvedOperations: approved,
      rejectedOperations: rejected,
      executedOperations: executed,
      rollbackableOperations: this.rollbackStack.length,
      byRiskLevel,
      byType: byType as Record<OperationType, number>,
    };
  }

  // ==========================================================================
  // 配置管理
  // ==========================================================================

  /**
   * 获取配置
   */
  getConfig(): AutonomyConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<AutonomyConfig>): void {
    Object.assign(this.config, updates);
    if (updates.mode) {
      this.mode = updates.mode;
    }
  }

  /**
   * 设置自动批准的风险级别
   */
  setAutoApproveRiskLevels(levels: RiskLevel[]): void {
    this.config.autoApproveRiskLevels = levels;
  }

  /**
   * 添加需要确认的操作类型
   */
  addRequireConfirmation(type: OperationType): void {
    if (!this.config.requireConfirmationFor.includes(type)) {
      this.config.requireConfirmationFor.push(type);
    }
  }

  /**
   * 移除需要确认的操作类型
   */
  removeRequireConfirmation(type: OperationType): void {
    const index = this.config.requireConfirmationFor.indexOf(type);
    if (index !== -1) {
      this.config.requireConfirmationFor.splice(index, 1);
    }
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    for (const { timeout } of this.pendingConfirmations.values()) {
      clearTimeout(timeout);
    }
    this.pendingConfirmations.clear();
    this.operations.clear();
    this.rollbackStack = [];
  }

  // ==========================================================================
  // 批量操作
  // ==========================================================================

  /**
   * 批量请求操作
   * Requirements: 11.3
   */
  async requestBatchOperations(
    operations: Array<{
      type: OperationType;
      description: string;
      details?: Record<string, unknown>;
      rollbackData?: unknown;
    }>
  ): Promise<Array<{ approved: boolean; operationId: string; reason?: string }>> {
    const results: Array<{ approved: boolean; operationId: string; reason?: string }> = [];
    
    for (const op of operations) {
      const result = await this.requestOperation(
        op.type,
        op.description,
        op.details ?? {},
        op.rollbackData
      );
      results.push(result);
      
      // 如果任何操作被拒绝，停止处理
      if (!result.approved) {
        break;
      }
    }
    
    return results;
  }

  /**
   * 批量回滚
   * Requirements: 11.4
   */
  async rollbackBatch(count: number): Promise<{
    success: boolean;
    rolledBack: OperationRecord[];
    errors: string[];
  }> {
    const rolledBack: OperationRecord[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const result = await this.rollbackLast();
      if (result.success && result.operation) {
        rolledBack.push(result.operation);
      } else if (result.error) {
        errors.push(result.error);
        break;
      }
    }
    
    return {
      success: errors.length === 0,
      rolledBack,
      errors,
    };
  }

  /**
   * 撤销所有未执行的操作
   */
  cancelPendingOperations(): number {
    let cancelled = 0;
    
    for (const [, op] of this.operations) {
      if (op.approved && !op.executed) {
        op.approved = false;
        op.result = { success: false, error: 'Cancelled' };
        cancelled++;
      }
    }
    
    return cancelled;
  }

  // ==========================================================================
  // 确认管理
  // ==========================================================================

  /**
   * 手动响应确认请求
   */
  respondToConfirmation(operationId: string, response: ConfirmationResponse): boolean {
    const pending = this.pendingConfirmations.get(operationId);
    if (!pending) return false;
    
    clearTimeout(pending.timeout);
    pending.resolve(response);
    this.pendingConfirmations.delete(operationId);
    return true;
  }

  /**
   * 获取待确认的操作
   */
  getPendingConfirmations(): string[] {
    return Array.from(this.pendingConfirmations.keys());
  }

  /**
   * 检查是否有待确认的操作
   */
  hasPendingConfirmations(): boolean {
    return this.pendingConfirmations.size > 0;
  }

  /**
   * 批准所有待确认的操作
   */
  approveAllPending(): number {
    let approved = 0;
    
    for (const operationId of this.pendingConfirmations.keys()) {
      if (this.respondToConfirmation(operationId, { approved: true })) {
        approved++;
      }
    }
    
    return approved;
  }

  /**
   * 拒绝所有待确认的操作
   */
  rejectAllPending(reason: string = 'Batch rejection'): number {
    let rejected = 0;
    
    for (const operationId of this.pendingConfirmations.keys()) {
      if (this.respondToConfirmation(operationId, { approved: false, reason })) {
        rejected++;
      }
    }
    
    return rejected;
  }
}

export default AutonomyController;
