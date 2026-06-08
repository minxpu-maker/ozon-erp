/**
 * 选品任务查询接口 - 第八阶段
 * GET /api/selection/run/[taskId]
 * 返回任务进度和结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTask } from '@/lib/selection-task-manager';
import { getLLMStats } from '@/lib/selection-engine';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少taskId参数' },
        { status: 400 }
      );
    }
    
    // 获取任务状态
    const task = getTask(taskId);
    
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在或已过期', taskId },
        { status: 404 }
      );
    }
    
    // 计算任务运行时长
    const duration = task.completedAt
      ? task.completedAt.getTime() - (task.startedAt?.getTime() || task.createdAt.getTime())
      : task.startedAt
        ? Date.now() - task.startedAt.getTime()
        : 0;
    
    // 构建响应
    const response = {
      success: true,
      taskId: task.id,
      status: task.status,
      progress: {
        ...task.progress,
        duration: Math.round(duration / 1000), // 秒
      },
      config: {
        shopId: task.shopId,
        categoryId: task.categoryId,
        strategy: task.strategy,
      },
      timing: {
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        duration: Math.round(duration / 1000),
      },
      dataSources: task.dataSources,
      completedLayers: task.completedLayers,
      warnings: task.warnings,
      // 根据状态返回不同数据
      ...(task.status === 'completed' && task.result ? {
        result: {
          processed: task.result.processed,
          successful: task.result.successful,
          failed: task.result.failed,
          topCandidates: task.result.topCandidates,
          dedupStats: task.result.dedupStats,
        },
      } : {}),
      ...(task.status === 'failed' ? {
        error: task.error,
      } : {}),
      // LLM调用统计
      llmRateLimit: getLLMStats(),
    };
    
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE 方法：取消任务
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    
    // 任务管理器中暂未实现取消功能
    // 这里返回提示信息
    return NextResponse.json({
      success: false,
      error: '任务取消功能暂未实现',
      message: '任务会自动在30分钟后过期',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '取消失败' },
      { status: 500 }
    );
  }
}
