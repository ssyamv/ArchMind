/**
 * 工作区管理 Composable
 */

import { ref, computed } from 'vue'

export interface Workspace {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  stats?: {
    documentCount: number
    prdCount: number
  }
}

const workspaces = ref<Workspace[]>([])
const currentWorkspaceId = ref<string | null>(null)
const loading = ref(false)

export function useWorkspace () {
  const currentWorkspace = computed(() => {
    if (!currentWorkspaceId.value) return null
    return workspaces.value.find(w => w.id === currentWorkspaceId.value) || null
  })

  const defaultWorkspace = computed(() => {
    return workspaces.value.find(w => w.isDefault) || null
  })

  /**
   * 加载所有工作区
   */
  async function loadWorkspaces () {
    loading.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Workspace[] }>('/api/v1/workspaces')
      workspaces.value = response.data

      // 如果还没有设置当前工作区,使用默认工作区
      if (!currentWorkspaceId.value) {
        const defaultWs = workspaces.value.find(w => w.isDefault)
        if (defaultWs) {
          currentWorkspaceId.value = defaultWs.id
          saveToLocalStorage()
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 切换工作区
   */
  async function switchWorkspace (workspaceId: string) {
    const workspace = workspaces.value.find(w => w.id === workspaceId)
    if (!workspace) {
      throw new Error('Workspace not found')
    }

    currentWorkspaceId.value = workspaceId
    saveToLocalStorage()

    // 触发工作区切换事件,通知其他组件刷新数据
    if (process.client) {
      window.dispatchEvent(new CustomEvent('workspace-changed', {
        detail: { workspaceId }
      }))
    }
  }

  /**
   * 创建工作区
   */
  async function createWorkspace (data: {
    name: string
    description?: string
    icon?: string
    color?: string
    isDefault?: boolean
  }) {
    loading.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Workspace }>(
        '/api/v1/workspaces',
        {
          method: 'POST',
          body: data
        }
      )

      workspaces.value.push(response.data)

      // 如果是默认工作区,更新其他工作区的 isDefault 状态
      if (response.data.isDefault) {
        workspaces.value.forEach((w) => {
          if (w.id !== response.data.id) {
            w.isDefault = false
          }
        })
      }

      return response.data
    } catch (error) {
      console.error('Failed to create workspace:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新工作区
   */
  async function updateWorkspace (
    workspaceId: string,
    data: {
      name?: string
      description?: string
      icon?: string
      color?: string
      isDefault?: boolean
    }
  ) {
    loading.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Workspace }>(
        `/api/v1/workspaces/${workspaceId}`,
        {
          method: 'PATCH',
          body: data
        }
      )

      const index = workspaces.value.findIndex(w => w.id === workspaceId)
      if (index !== -1) {
        workspaces.value[index] = response.data

        // 如果是设置为默认工作区,更新其他工作区的 isDefault 状态
        if (response.data.isDefault) {
          workspaces.value.forEach((w) => {
            if (w.id !== workspaceId) {
              w.isDefault = false
            }
          })
        }
      }

      return response.data
    } catch (error) {
      console.error('Failed to update workspace:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除工作区
   */
  async function deleteWorkspace (workspaceId: string) {
    loading.value = true
    try {
      await $fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'DELETE'
      })

      workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)

      // 如果删除的是当前工作区,切换到默认工作区
      if (currentWorkspaceId.value === workspaceId) {
        const defaultWs = workspaces.value.find(w => w.isDefault)
        if (defaultWs) {
          await switchWorkspace(defaultWs.id)
        }
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置默认工作区
   */
  async function setDefaultWorkspace (workspaceId: string) {
    loading.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Workspace }>(
        `/api/v1/workspaces/${workspaceId}/set-default`,
        {
          method: 'POST'
        }
      )

      // 更新所有工作区的 isDefault 状态
      workspaces.value.forEach((w) => {
        w.isDefault = w.id === workspaceId
      })

      return response.data
    } catch (error) {
      console.error('Failed to set default workspace:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 从 localStorage 加载当前工作区
   */
  function loadFromLocalStorage () {
    if (process.client) {
      const savedId = localStorage.getItem('current-workspace-id')
      if (savedId) {
        currentWorkspaceId.value = savedId
      }
    }
  }

  /**
   * 保存当前工作区到 localStorage
   */
  function saveToLocalStorage () {
    if (process.client && currentWorkspaceId.value) {
      localStorage.setItem('current-workspace-id', currentWorkspaceId.value)
    }
  }

  /**
   * 刷新工作区统计信息
   */
  async function refreshStats (workspaceId: string) {
    try {
      const response = await $fetch<{ success: boolean; data: Workspace }>(
        `/api/v1/workspaces/${workspaceId}`
      )

      const index = workspaces.value.findIndex(w => w.id === workspaceId)
      if (index !== -1 && response.data.stats) {
        workspaces.value[index].stats = response.data.stats
      }
    } catch (error) {
      console.error('Failed to refresh workspace stats:', error)
    }
  }

  // 初始化时从 localStorage 加载
  if (process.client) {
    loadFromLocalStorage()
  }

  return {
    // State
    workspaces: computed(() => workspaces.value),
    currentWorkspace,
    currentWorkspaceId: computed(() => currentWorkspaceId.value),
    defaultWorkspace,
    loading: computed(() => loading.value),

    // Methods
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    setDefaultWorkspace,
    refreshStats
  }
}
