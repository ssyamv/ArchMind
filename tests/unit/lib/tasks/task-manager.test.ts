/**
 * #69 AI 任务管理器 - 并发限制单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AITaskDAO
const mockCreate = vi.fn()
const mockCountRunning = vi.fn()
const mockUpdateStatus = vi.fn()

vi.mock('~/lib/db/dao/ai-task-dao', () => ({
  AITaskDAO: {
    create: (...args: any[]) => mockCreate(...args),
    countRunning: (...args: any[]) => mockCountRunning(...args),
    updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  },
}))

const { AITaskManager } = await import('~/lib/tasks/task-manager')

describe('AITaskManager', () => {
  let manager: InstanceType<typeof AITaskManager>

  beforeEach(() => {
    manager = new AITaskManager()
    vi.clearAllMocks()
  })

  it('未达并发限制时立即标记为 running', async () => {
    mockCountRunning.mockResolvedValue(0)
    mockCreate.mockResolvedValue({
      id: 'task-1',
      status: 'pending',
      type: 'prd_generate',
    })
    mockUpdateStatus.mockResolvedValue(undefined)

    const { task, queued } = await manager.createTask({
      workspaceId: 'ws-1',
      userId: 'user-1',
      type: 'prd_generate',
      title: '测试 PRD',
    })

    expect(queued).toBe(false)
    expect(task.status).toBe('running')
    expect(mockUpdateStatus).toHaveBeenCalledWith('task-1', 'running')
  })

  it('达到并发限制时排队（queued=true）', async () => {
    mockCountRunning.mockResolvedValue(2) // prd_generate 限制为 2
    mockCreate.mockResolvedValue({
      id: 'task-2',
      status: 'pending',
      type: 'prd_generate',
    })

    const { task, queued } = await manager.createTask({
      workspaceId: 'ws-1',
      userId: 'user-1',
      type: 'prd_generate',
    })

    expect(queued).toBe(true)
    expect(task.status).toBe('pending')
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('complete 方法设置进度为 100', async () => {
    mockUpdateStatus.mockResolvedValue(undefined)
    await manager.complete('task-1', 'prd-123')
    expect(mockUpdateStatus).toHaveBeenCalledWith('task-1', 'completed', {
      progress: 100,
      outputRef: 'prd-123',
    })
  })

  it('fail 方法记录错误信息', async () => {
    mockUpdateStatus.mockResolvedValue(undefined)
    await manager.fail('task-1', '模型调用失败')
    expect(mockUpdateStatus).toHaveBeenCalledWith('task-1', 'failed', {
      error: '模型调用失败',
    })
  })

  it('updateProgress 方法更新进度', async () => {
    mockUpdateStatus.mockResolvedValue(undefined)
    await manager.updateProgress('task-1', 50)
    expect(mockUpdateStatus).toHaveBeenCalledWith('task-1', 'running', {
      progress: 50,
    })
  })

  it('createTask 传递 input 参数到 DAO', async () => {
    mockCountRunning.mockResolvedValue(0)
    mockCreate.mockResolvedValue({
      id: 'task-3',
      status: 'pending',
      type: 'prd_generate',
    })
    mockUpdateStatus.mockResolvedValue(undefined)

    const input = { prdId: 'prd-1', modelId: 'glm-4' }
    await manager.createTask({
      workspaceId: 'ws-1',
      userId: 'user-1',
      type: 'prd_generate',
      input,
    })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ input }))
  })
})
