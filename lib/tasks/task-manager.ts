/**
 * AI 任务管理器（#69）
 * 管理并发限制、任务生命周期
 */

import { AITaskDAO, type AITaskType } from '../db/dao/ai-task-dao'

/** 每个用户每种任务类型的最大并发数 */
const CONCURRENCY_LIMITS: Record<AITaskType, number> = {
  prd_generate: 2,
  prototype_generate: 1,
  logic_map_generate: 2,
  document_process: 3,
  workspace_export: 1,
}

export class AITaskManager {
  /** 创建任务（pending 状态），检查并发限制 */
  async createTask (input: {
    workspaceId: string
    userId: string
    type: AITaskType
    title?: string
    input?: Record<string, unknown>
  }): Promise<{ task: Awaited<ReturnType<typeof AITaskDAO.create>>; queued: boolean }> {
    const running = await AITaskDAO.countRunning(input.userId, input.type)
    const limit = CONCURRENCY_LIMITS[input.type] ?? 2
    const queued = running >= limit

    const task = await AITaskDAO.create(input)

    // 未超并发时立即标记 running
    if (!queued) {
      await AITaskDAO.updateStatus(task.id, 'running')
      task.status = 'running'
    }

    return { task, queued }
  }

  async complete (taskId: string, outputRef?: string): Promise<void> {
    await AITaskDAO.updateStatus(taskId, 'completed', { progress: 100, outputRef })
  }

  async fail (taskId: string, error: string): Promise<void> {
    await AITaskDAO.updateStatus(taskId, 'failed', { error })
  }

  async updateProgress (taskId: string, progress: number): Promise<void> {
    await AITaskDAO.updateStatus(taskId, 'running', { progress })
  }
}

export const aiTaskManager = new AITaskManager()
