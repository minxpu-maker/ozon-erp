/**
 * 选品任务状态管理模块
 * 用于管理异步选品任务的状态、进度和结果
 */

import { SelectionStrategy } from './selection-engine';

// 任务状态枚举
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务进度信息
export interface TaskProgress {
  current: number;       // 当前处理数量
  total: number;         // 总数量
  stage: string;         // 当前阶段描述
  percentage: number;    // 百分比 0-100
}

// 数据源状态
export interface DataSourceStatus {
  name: string;          // 数据源名称
  status: 'success' | 'failed' | 'skipped';
  message?: string;      // 错误信息
  dataCount?: number;    // 获取数据数量
}

// 选品任务
export interface SelectionTask {
  id: string;            // 任务ID
  shopId: string;        // 店铺ID
  categoryId?: number;   // 可选类目ID
  strategy: SelectionStrategy; // 选品策略
  
  status: TaskStatus;    // 任务状态
  progress: TaskProgress; // 进度信息
  
  createdAt: Date;       // 创建时间
  startedAt?: Date;      // 开始时间
  completedAt?: Date;    // 完成时间
  
  // 结果数据
  result?: {
    processed: number;   // 处理数量
    successful: number;  // 成功数量
    failed: number;      // 失败数量
    topCandidates: Array<{
      id: number;
      score: number;
      grade: string;
      name?: string;
    }>;
    dedupStats?: {
      original: number;
      kept: number;
      removed: number;
    };
  };
  
  // 数据源状态
  dataSources: DataSourceStatus[];
  
  // 错误信息
  error?: string;
  
  // 已完成的层数
  completedLayers: number[];
  
  // 警告信息
  warnings: string[];
}

// 内存任务存储
const taskStore = new Map<string, SelectionTask>();

// 任务过期时间（30分钟）
const TASK_EXPIRY_MS = 30 * 60 * 1000;

/**
 * 生成任务ID
 */
export function generateTaskId(): string {
  return `sel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 创建新任务
 */
export function createTask(
  shopId: string,
  categoryId?: number,
  strategy: SelectionStrategy = 'follow_default'
): SelectionTask {
  // 清理过期任务
  cleanupExpiredTasks();
  
  const taskId = generateTaskId();
  const task: SelectionTask = {
    id: taskId,
    shopId,
    categoryId,
    strategy,
    status: 'pending',
    progress: {
      current: 0,
      total: 0,
      stage: '初始化',
      percentage: 0,
    },
    createdAt: new Date(),
    dataSources: [],
    completedLayers: [],
    warnings: [],
  };
  
  taskStore.set(taskId, task);
  return task;
}

/**
 * 获取任务
 */
export function getTask(taskId: string): SelectionTask | undefined {
  return taskStore.get(taskId);
}

/**
 * 更新任务
 */
export function updateTask(taskId: string, updates: Partial<SelectionTask>): SelectionTask | undefined {
  const task = taskStore.get(taskId);
  if (!task) return undefined;
  
  const updatedTask = { ...task, ...updates };
  taskStore.set(taskId, updatedTask);
  return updatedTask;
}

/**
 * 更新任务进度
 */
export function updateProgress(
  taskId: string,
  current: number,
  total: number,
  stage: string
): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  task.progress = { current, total, stage, percentage };
  taskStore.set(taskId, task);
}

/**
 * 标记数据源状态
 */
export function markDataSource(
  taskId: string,
  name: string,
  status: 'success' | 'failed' | 'skipped',
  message?: string,
  dataCount?: number
): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  // 检查是否已存在
  const existingIndex = task.dataSources.findIndex(ds => ds.name === name);
  const ds: DataSourceStatus = { name, status, message, dataCount };
  
  if (existingIndex >= 0) {
    task.dataSources[existingIndex] = ds;
  } else {
    task.dataSources.push(ds);
  }
  
  taskStore.set(taskId, task);
}

/**
 * 添加警告
 */
export function addWarning(taskId: string, warning: string): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  task.warnings.push(warning);
  taskStore.set(taskId, task);
}

/**
 * 标记层数完成
 */
export function markLayerCompleted(taskId: string, layer: number): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  if (!task.completedLayers.includes(layer)) {
    task.completedLayers.push(layer);
  }
  taskStore.set(taskId, task);
}

/**
 * 完成任务
 */
export function completeTask(
  taskId: string,
  result: SelectionTask['result']
): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  task.status = 'completed';
  task.completedAt = new Date();
  task.result = result;
  task.progress = {
    ...task.progress,
    current: task.progress.total,
    percentage: 100,
    stage: '完成',
  };
  taskStore.set(taskId, task);
}

/**
 * 任务失败
 */
export function failTask(taskId: string, error: string): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  task.status = 'failed';
  task.completedAt = new Date();
  task.error = error;
  task.progress.stage = '失败';
  taskStore.set(taskId, task);
}

/**
 * 开始任务
 */
export function startTask(taskId: string): void {
  const task = taskStore.get(taskId);
  if (!task) return;
  
  task.status = 'running';
  task.startedAt = new Date();
  task.progress.stage = '评分计算中';
  taskStore.set(taskId, task);
}

/**
 * 清理过期任务
 */
function cleanupExpiredTasks(): void {
  const now = Date.now();
  for (const [id, task] of taskStore) {
    const taskTime = task.completedAt?.getTime() || task.createdAt.getTime();
    if (now - taskTime > TASK_EXPIRY_MS) {
      taskStore.delete(id);
    }
  }
}

/**
 * 获取所有任务（用于调试）
 */
export function getAllTasks(): SelectionTask[] {
  return Array.from(taskStore.values());
}
