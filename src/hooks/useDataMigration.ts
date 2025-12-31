/**
 * ✨ 数据迁移 Hook
 *
 * 功能：
 * - 检测版本升级
 * - 自动执行数据迁移任务
 * - 清理损坏/过时的数据
 */

import { useEffect } from 'react';

const MIGRATION_VERSION_KEY = 'data_migration_version';
const CURRENT_MIGRATION_VERSION = '1.2.7';

/**
 * 清理损坏的小时统计数据
 *
 * 问题：v1.2.5之前的版本存在Bug，导致小时统计数据异常高（重复累加整个会话费用）
 * 解决：清空所有旧的小时统计数据，让新版本从头记录
 */
function migrateHourlyUsageData() {
  try {
    const hourlyData = localStorage.getItem('hourly_usage_tracking');
    if (hourlyData) {
      console.log('[DataMigration] 🔧 检测到旧版本的小时统计数据，正在清理...');
      localStorage.removeItem('hourly_usage_tracking');
      console.log('[DataMigration] ✅ 小时统计数据已清理，将从头开始记录');
    }
  } catch (error) {
    console.error('[DataMigration] ❌ 清理小时统计数据失败:', error);
  }
}

/**
 * 清理损坏的费用快照数据
 *
 * 问题：v1.2.6之前的版本存在Bug，导致费用快照可能不准确
 * 解决：清空所有版本的费用快照，让新版本重新计算
 */
function migrateCostSnapshotData() {
  try {
    // 清理所有版本的费用快照（v1, v2, v3）
    const oldKeys = ['session_cost_snapshot', 'session_cost_snapshot_v2', 'session_cost_snapshot_v3'];
    let cleaned = false;

    oldKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        cleaned = true;
      }
    });

    if (cleaned) {
      console.log('[DataMigration] 🔧 清理了所有版本的费用快照数据');
    }
  } catch (error) {
    console.error('[DataMigration] ❌ 清理费用快照数据失败:', error);
  }
}

/**
 * 执行所有迁移任务
 */
function runMigrations() {
  console.log('[DataMigration] 🚀 开始数据迁移到版本', CURRENT_MIGRATION_VERSION);

  // 执行各个迁移任务
  migrateHourlyUsageData();
  migrateCostSnapshotData();

  // 标记迁移完成
  localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);

  console.log('[DataMigration] ✅ 数据迁移完成');
}

/**
 * 数据迁移 Hook
 *
 * 在应用启动时自动检测版本并执行必要的数据迁移
 */
export function useDataMigration() {
  useEffect(() => {
    const lastMigrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY);

    // 如果从未执行过迁移，或版本不同，执行迁移
    if (!lastMigrationVersion || lastMigrationVersion !== CURRENT_MIGRATION_VERSION) {
      runMigrations();
    } else {
      console.log('[DataMigration] ✨ 数据已是最新版本，无需迁移');
    }
  }, []);
}

export default useDataMigration;
