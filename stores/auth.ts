/**
 * 认证状态管理
 */

import { defineStore } from 'pinia'
import type { User, AuthState, RegisterRequest, LoginRequest, AuthResponse, ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, ResetPasswordResponse } from '~/types/auth'

// 用户更新请求类型
interface UpdateUserRequest {
  fullName?: string
  avatarUrl?: string | null
}

interface UpdateUserResponse {
  success: boolean
  user?: User
  message?: string
}

interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

interface ChangePasswordResponse {
  success: boolean
  message?: string
}

interface AvatarResponse {
  success: boolean
  avatarUrl?: string
  message?: string
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),

  getters: {
    /**
     * 获取用户显示名称
     */
    displayName: (state): string => {
      if (state.user?.fullName) {
        return state.user.fullName
      }
      if (state.user?.email) {
        return state.user.email.split('@')[0]
      }
      return '用户'
    },

    /**
     * 获取用户头像 URL
     * user.avatarUrl 已经是预签名 URL（由 /api/v1/auth/me 处理）
     */
    avatarUrl: (state): string => {
      if (state.user?.avatarUrl) {
        return state.user.avatarUrl
      }
      // 使用 Gravatar 作为后备
      if (state.user?.email) {
        const emailHash = state.user.email.toLowerCase().trim()
        return `https://www.gravatar.com/avatar/${encodeURIComponent(emailHash)}?d=mp&s=100`
      }
      return ''
    }
  },

  actions: {
    /**
     * 用户注册
     */
    async register(data: RegisterRequest): Promise<boolean> {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<AuthResponse>('/api/v1/auth/register', {
          method: 'POST',
          body: data,
          credentials: 'include'
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
          return true
        } else {
          this.error = response.message || '注册失败'
          return false
        }
      } catch (error: any) {
        this.error = error.data?.message || error.message || '注册失败'
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * 用户登录
     */
    async login(email: string, password: string): Promise<boolean> {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<AuthResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: { email, password } as LoginRequest,
          credentials: 'include'
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
          return true
        } else {
          this.error = response.message || '登录失败'
          return false
        }
      } catch (error: any) {
        this.error = error.data?.message || error.message || '登录失败'
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * 用户登出
     */
    async logout(): Promise<void> {
      this.loading = true

      try {
        await $fetch<AuthResponse>('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'include'
        })
      } catch (error) {
        console.error('登出请求失败:', error)
      } finally {
        this.user = null
        this.isAuthenticated = false
        this.loading = false
        this.error = null
      }
    },

    /**
     * 获取当前用户信息
     */
    async fetchCurrentUser(): Promise<void> {
      this.loading = true

      try {
        const response = await $fetch<AuthResponse>('/api/v1/auth/me', {
          credentials: 'include'
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
        } else {
          this.user = null
          this.isAuthenticated = false
        }
      } catch {
        this.user = null
        this.isAuthenticated = false
      } finally {
        this.loading = false
      }
    },

    /**
     * 检查认证状态（用于初始化）
     */
    async checkAuth(): Promise<void> {
      // 只在客户端执行
      if (import.meta.server) {
        return
      }

      // 如果已经有用户信息，不再重复获取
      if (this.user && this.isAuthenticated) {
        return
      }

      await this.fetchCurrentUser()
    },

    /**
     * 清除错误
     */
    clearError(): void {
      this.error = null
    },

    /**
     * 设置错误
     */
    setError(message: string): void {
      this.error = message
    },

    /**
     * 更新用户信息
     */
    async updateProfile(data: UpdateUserRequest): Promise<{ success: boolean; message?: string }> {
      this.loading = true
      this.error = null

      // 保存当前的头像 URL，用于比较
      const currentAvatarUrl = this.user?.avatarUrl

      try {
        const response = await $fetch<UpdateUserResponse>('/api/v1/user', {
          method: 'PUT',
          body: data,
          credentials: 'include'
        })

        if (response.success && response.user) {
          // 如果请求中没有修改头像，且当前有头像，保留当前头像 URL（避免不必要的刷新）
          if (!data.avatarUrl && currentAvatarUrl) {
            response.user.avatarUrl = currentAvatarUrl
          }
          this.user = response.user
          return { success: true }
        } else {
          this.error = response.message || '更新失败'
          return { success: false, message: response.message }
        }
      } catch (error: any) {
        const message = error.data?.message || error.message || '更新失败'
        this.error = message
        return { success: false, message }
      } finally {
        this.loading = false
      }
    },

    /**
     * 上传头像
     */
    async uploadAvatar(file: File): Promise<{ success: boolean; avatarUrl?: string; message?: string }> {
      this.loading = true
      this.error = null

      try {
        const formData = new FormData()
        formData.append('avatar', file)

        const response = await $fetch<AvatarResponse>('/api/v1/user/avatar', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        if (response.success && response.avatarUrl) {
          // 更新用户头像 URL（预签名 URL）
          if (this.user) {
            this.user = { ...this.user, avatarUrl: response.avatarUrl }
          }
          return { success: true, avatarUrl: response.avatarUrl }
        } else {
          this.error = response.message || '上传失败'
          return { success: false, message: response.message }
        }
      } catch (error: any) {
        const message = error.data?.message || error.message || '上传失败'
        this.error = message
        return { success: false, message }
      } finally {
        this.loading = false
      }
    },

    /**
     * 修改密码
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<ChangePasswordResponse>('/api/v1/user/password', {
          method: 'PUT',
          body: { currentPassword, newPassword } as ChangePasswordRequest,
          credentials: 'include'
        })

        if (response.success) {
          return { success: true, message: response.message }
        } else {
          this.error = response.message || '修改密码失败'
          return { success: false, message: response.message }
        }
      } catch (error: any) {
        const message = error.data?.message || error.message || '修改密码失败'
        this.error = message
        return { success: false, message }
      } finally {
        this.loading = false
      }
    },

    /**
     * 忘记密码 - 发送重置邮件
     */
    async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<ForgotPasswordResponse>('/api/v1/auth/forgot-password', {
          method: 'POST',
          body: { email } as ForgotPasswordRequest
        })

        if (response.success) {
          return { success: true, message: response.message }
        } else {
          this.error = response.message || '发送重置邮件失败'
          return { success: false, message: response.message }
        }
      } catch (error: any) {
        const message = error.data?.message || error.message || '发送重置邮件失败'
        this.error = message
        return { success: false, message }
      } finally {
        this.loading = false
      }
    },

    /**
     * 重置密码
     */
    async resetPassword(token: string, email: string, password: string, confirmPassword: string): Promise<{ success: boolean; message?: string }> {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<ResetPasswordResponse>('/api/v1/auth/reset-password', {
          method: 'POST',
          body: { token, email, password, confirmPassword } as ResetPasswordRequest,
          credentials: 'include'
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
          return { success: true, message: response.message }
        } else {
          this.error = response.message || '重置密码失败'
          return { success: false, message: response.message }
        }
      } catch (error: any) {
        const message = error.data?.message || error.message || '重置密码失败'
        this.error = message
        return { success: false, message }
      } finally {
        this.loading = false
      }
    }
  }
})
