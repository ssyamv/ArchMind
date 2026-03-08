import type { OnboardingState } from '~/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '~/types/onboarding'

export function useOnboarding() {
  const state = ref<OnboardingState>({ ...DEFAULT_ONBOARDING_STATE })
  const isLoading = ref(false)

  const shouldShowWelcome = computed(() =>
    !state.value.skipped &&
    !state.value.completedAt &&
    !state.value.hasGeneratedPRD
  )

  const completedSteps = computed(() =>
    [
      state.value.hasConfiguredAI,
      state.value.hasUploadedDocument,
      state.value.hasGeneratedPRD,
    ].filter(Boolean).length
  )

  async function fetchState() {
    isLoading.value = true
    try {
      const res = await $fetch<{ success: boolean; data: OnboardingState }>(
        '/api/v1/users/me/onboarding'
      )
      if (res.success) state.value = res.data
    } catch {
      // 获取失败时保持默认值，不中断页面渲染
    } finally {
      isLoading.value = false
    }
  }

  async function markStep(step: keyof Pick<OnboardingState, 'hasConfiguredAI' | 'hasUploadedDocument' | 'hasGeneratedPRD'>, value: boolean) {
    const patch: Partial<OnboardingState> = { [step]: value }

    // 三步全完成时自动记录 completedAt
    const next = { ...state.value, ...patch }
    if (next.hasConfiguredAI && next.hasUploadedDocument && next.hasGeneratedPRD && !next.completedAt) {
      patch.completedAt = new Date().toISOString()
    }

    try {
      const res = await $fetch<{ success: boolean; data: OnboardingState }>(
        '/api/v1/users/me/onboarding',
        { method: 'PATCH', body: patch }
      )
      if (res.success) state.value = res.data
    } catch {
      // 乐观更新：即使保存失败也更新本地状态
      state.value = { ...state.value, ...patch }
    }
  }

  async function skipOnboarding() {
    state.value = { ...state.value, skipped: true }
    try {
      await $fetch('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: { skipped: true },
      })
    } catch {
      // 忽略保存失败，本地已更新
    }
  }

  return {
    state,
    isLoading,
    shouldShowWelcome,
    completedSteps,
    fetchState,
    markStep,
    skipOnboarding,
  }
}
