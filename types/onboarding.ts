export interface OnboardingState {
  hasConfiguredAI: boolean
  hasUploadedDocument: boolean
  hasGeneratedPRD: boolean
  skipped: boolean
  completedAt?: string
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  hasConfiguredAI: false,
  hasUploadedDocument: false,
  hasGeneratedPRD: false,
  skipped: false,
}
