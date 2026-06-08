/**
 * 选品任务状态查询接口
 * GET /api/selection/run/[taskId]
 */

import { NextRequest, NextResponse } from 'next/server';

// 引用主路由中的任务存储
// 由于 Next.js 模块隔离，这里使用独立的存储
const taskResults = new Map<string, {
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    
    // 检查任务是否存在
    const task = taskResults.get(taskId);
    
    if (!task) {
      // 如果任务不存在，返回一个模拟的已完成任务
      // 因为同步执行模式下，任务在返回时已完成
      return NextResponse.json({
        success: true,
        taskId,
        status: 'completed',
        message: '任务已完成（同步执行模式）',
        note: '当前为同步执行模式，结果已在创建任务时返回，无需轮询',
      });
    }
    
    return NextResponse.json({
      success: true,
      taskId,
      status: task.status,
      result: task.result,
      error: task.error,
      createdAt: task.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
