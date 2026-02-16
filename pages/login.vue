<template>
  <div class="auth-container">
    <!-- Left Panel - Branding -->
    <div class="auth-branding">
      <div class="branding-content">
        <!-- Animated Logo -->
        <div class="logo-container animate-float">
          <div class="logo-ring"></div>
          <div class="logo-ring logo-ring-2"></div>
          <div class="logo-glow"></div>
          <div class="logo-core">
            <img src="/logo-auth.png" alt="ArchMind" class="logo-img logo-light" />
            <img src="/logo.png" alt="ArchMind" class="logo-img logo-dark" />
          </div>
        </div>

        <h1 class="brand-title">
          <span class="title-line title-line-1">
            <span class="gradient-text">ArchMind</span>
          </span>
          <span class="title-line title-line-2">
            <span class="gradient-text-animated">AI</span>
          </span>
        </h1>

        <p class="brand-tagline">
          <ClientOnly>
            <ShinyText :text="$t('app.tagline') || 'Transform Ideas into Deliverables'" :speed="4" />
            <template #fallback>
              <span>{{ $t('app.tagline') || 'Transform Ideas into Deliverables' }}</span>
            </template>
          </ClientOnly>
        </p>

        <!-- Feature Pills -->
        <div class="feature-pills">
          <div class="pill pill-1">
            <Zap class="pill-icon" />
            <span>AI-Powered</span>
          </div>
          <div class="pill pill-2">
            <Shield class="pill-icon" />
            <span>RAG Engine</span>
          </div>
          <div class="pill pill-3">
            <Layers class="pill-icon" />
            <span>Prototype</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel - Form -->
    <div class="auth-form-panel">
      <div class="form-wrapper">
        <!-- Header -->
        <div class="form-header">
          <NuxtLink to="/" class="mobile-logo">
            <img src="/logo.png" alt="ArchMind" class="logo-mini" />
            <span>ArchMind</span>
          </NuxtLink>
          <h2 class="form-title">{{ $t('auth.login') }}</h2>
          <p class="form-subtitle">{{ $t('auth.loginSubtitle') }}</p>
        </div>

        <!-- Form -->
        <form @submit="handleSubmit" class="auth-form">
          <!-- Error Alert -->
          <Transition name="shake">
            <div v-if="authStore.error" class="error-alert">
              <div class="error-icon-wrapper">
                <AlertCircle class="w-5 h-5" />
              </div>
              <span>{{ authStore.error }}</span>
            </div>
          </Transition>

          <!-- Email Field -->
          <div class="input-group" :class="{ focused: focusedField === 'email', filled: email }">
            <label for="email">{{ $t('auth.email') }}</label>
            <div class="input-wrapper">
              <Mail class="input-icon" />
              <input
                id="email"
                v-model="email"
                type="email"
                :placeholder="$t('auth.emailPlaceholder')"
                :disabled="authStore.loading"
                required
                @focus="focusedField = 'email'"
                @blur="focusedField = ''"
              />
              <div class="input-border"></div>
            </div>
          </div>

          <!-- Password Field -->
          <div class="input-group" :class="{ focused: focusedField === 'password', filled: password }">
            <label for="password">{{ $t('auth.password') }}</label>
            <div class="input-wrapper">
              <Lock class="input-icon" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="$t('auth.passwordPlaceholder')"
                :disabled="authStore.loading"
                required
                @focus="focusedField = 'password'"
                @blur="focusedField = ''"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" class="w-5 h-5" />
                <EyeOff v-else class="w-5 h-5" />
              </button>
              <div class="input-border"></div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="submit-btn"
            :class="{ loading: authStore.loading }"
            :disabled="authStore.loading"
          >
            <span class="btn-content">
              <Loader2 v-if="authStore.loading" class="btn-icon animate-spin" />
              <ArrowRight v-else class="btn-icon" />
              <span>{{ authStore.loading ? $t('auth.loggingIn') : $t('auth.login') }}</span>
            </span>
            <div class="btn-glow"></div>
          </button>
        </form>

        <!-- Footer -->
        <div class="form-footer">
          <p>
            {{ $t('auth.noAccount') }}
            <NuxtLink to="/register" class="link-highlight">
              {{ $t('auth.register') }}
              <ArrowRight class="link-arrow" />
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles, Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, ArrowRight, Zap, Shield, Layers } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import ShinyText from '~/components/ui/bits/ShinyText.vue'

definePageMeta({
  layout: 'auth'
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Clear error on page load
onMounted(() => {
  authStore.clearError()
})

// Form state
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const focusedField = ref('')

// Submit handler
const handleSubmit = async (e: Event) => {
  e.preventDefault()

  if (!email.value || !password.value) {
    return
  }

  authStore.clearError()
  const success = await authStore.login(email.value, password.value)
  if (success) {
    const redirect = route.query.redirect as string || '/app'
    router.push(redirect)
  }
}
</script>

<style scoped>
/* ===== Container ===== */
.auth-container {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  padding-top: 4rem; /* Account for nav bar */
}

@media (max-width: 968px) {
  .auth-container {
    grid-template-columns: 1fr;
  }
}

/* ===== Branding Panel ===== */
.auth-branding {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  position: relative;
}

@media (max-width: 968px) {
  .auth-branding {
    display: none;
  }
}

.branding-content {
  text-align: center;
  max-width: 400px;
}

/* Logo Animation - Monochrome */
.logo-container {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 2rem;
}

.logo-ring {
  position: absolute;
  inset: 0;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  animation: ring-pulse 3s ease-in-out infinite;
}

.logo-ring-2 {
  inset: -15px;
  border-color: hsl(var(--border) / 0.5);
  animation-delay: -1.5s;
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 1; }
}

.logo-core {
  position: absolute;
  inset: 20px;
  background: hsl(var(--background));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow:
    0 0 40px hsl(var(--foreground) / 0.1),
    inset 0 0 20px hsl(var(--foreground) / 0.05);
}

.logo-img {
  width: 50px;
  height: 50px;
  object-fit: contain;
  border-radius: 50%;
  position: absolute;
}

.logo-light {
  display: block;
}

.logo-dark {
  display: none;
}

.dark .logo-light {
  display: none;
}

.dark .logo-dark {
  display: block;
}

/* Brand Title */
.brand-title {
  margin-bottom: 1.5rem;
}

.title-line {
  display: block;
  line-height: 1;
}

.title-line-1 {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.title-line-2 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 0.25rem;
}

/* Gradient Text Effects - Monochrome */
.gradient-text {
  background: linear-gradient(
    135deg,
    hsl(var(--foreground)) 0%,
    hsl(var(--muted-foreground)) 50%,
    hsl(var(--foreground)) 100%
  );
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 4s ease-in-out infinite;
}

.gradient-text-animated {
  background: linear-gradient(
    90deg,
    hsl(var(--foreground)) 0%,
    hsl(var(--muted-foreground)) 50%,
    hsl(var(--foreground)) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-flow 3s linear infinite;
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.brand-tagline {
  color: hsl(var(--muted-foreground));
  font-size: 1.1rem;
  margin-bottom: 3rem;
  letter-spacing: 0.05em;
}

/* Feature Pills */
.feature-pills {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 100px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  animation: pill-enter 0.6s ease-out backwards;
}

.pill-1 { animation-delay: 0.2s; }
.pill-2 { animation-delay: 0.4s; }
.pill-3 { animation-delay: 0.6s; }

@keyframes pill-enter {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.pill-icon {
  width: 16px;
  height: 16px;
  color: hsl(var(--foreground));
}

/* ===== Form Panel ===== */
.auth-form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.form-wrapper {
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  background: hsl(var(--card) / 0.5);
  border: 1px solid hsl(var(--border));
  border-radius: 24px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 0 0 1px hsl(var(--border) / 0.5) inset,
    0 25px 50px -12px hsl(var(--foreground) / 0.05);
  animation: form-enter 0.8s ease-out;
  position: relative;
  overflow: hidden;
}

.form-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsl(var(--border)) 20%,
    hsl(var(--foreground) / 0.3) 50%,
    hsl(var(--border)) 80%,
    transparent 100%
  );
}

.form-wrapper::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at 50% 0%,
    hsl(var(--foreground) / 0.03) 0%,
    transparent 50%
  );
  pointer-events: none;
}

@keyframes form-enter {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

.mobile-logo {
  display: none;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
  color: hsl(var(--foreground));
  text-decoration: none;
  font-weight: 600;
  font-size: 1.25rem;
}

@media (max-width: 968px) {
  .mobile-logo {
    display: flex;
  }
}

.logo-mini {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: contain;
}

/* Form Header */
.form-header {
  margin-bottom: 2.5rem;
  position: relative;
  z-index: 1;
}

.form-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.form-subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

/* ===== Form Styles ===== */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
  z-index: 1;
}

/* Error Alert */
.error-alert {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.125rem;
  background: hsl(var(--destructive) / 0.1);
  border: 1px solid hsl(var(--destructive) / 0.2);
  border-radius: 14px;
  color: hsl(var(--destructive));
  font-size: 0.875rem;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.error-icon-wrapper {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: hsl(var(--destructive) / 0.15);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shake-enter-active {
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

/* Input Groups */
.input-group {
  position: relative;
}

.input-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.625rem;
  transition: all 0.3s ease;
  letter-spacing: 0.02em;
}

.input-group.focused label {
  color: hsl(var(--foreground));
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 1.125rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: hsl(var(--muted-foreground) / 0.5);
  transition: all 0.3s ease;
  pointer-events: none;
}

.input-group.focused .input-icon {
  color: hsl(var(--foreground));
  transform: translateY(-50%) scale(1.1);
}

.input-wrapper input {
  width: 100%;
  padding: 0.9375rem 1rem 0.9375rem 2.875rem;
  background: hsl(var(--input));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  transition: all 0.3s ease;
  outline: none;
}

.input-wrapper input::placeholder {
  color: hsl(var(--muted-foreground) / 0.5);
}

.input-wrapper input:focus {
  background: hsl(var(--background));
  border-color: hsl(var(--foreground) / 0.3);
  box-shadow: 0 0 0 3px hsl(var(--foreground) / 0.05);
}

.input-wrapper input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Autofill styles */
.input-wrapper input:-webkit-autofill,
.input-wrapper input:-webkit-autofill:hover,
.input-wrapper input:-webkit-autofill:focus,
.input-wrapper input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px hsl(var(--input)) inset !important;
  -webkit-text-fill-color: hsl(var(--foreground)) !important;
  caret-color: hsl(var(--foreground)) !important;
  transition: background-color 5000s ease-in-out 0s;
}

.input-border {
  position: absolute;
  bottom: 1px;
  left: 14px;
  right: 14px;
  height: 0;
  background: hsl(var(--foreground));
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 0 2px 2px;
}

.input-group.focused .input-border {
  height: 2px;
}

/* Password Toggle */
.password-toggle {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: hsl(var(--muted-foreground) / 0.5);
  cursor: pointer;
  padding: 0.25rem;
  transition: all 0.3s ease;
  border-radius: 6px;
}

.password-toggle:hover {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
}

/* Submit Button - Monochrome */
.submit-btn {
  position: relative;
  width: 100%;
  padding: 1rem 1.5rem;
  background: hsl(var(--foreground));
  border: none;
  border-radius: 14px;
  color: hsl(var(--background));
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 0.75rem;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 15px hsl(var(--foreground) / 0.2);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px hsl(var(--foreground) / 0.3);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.3s ease;
}

.submit-btn:hover:not(:disabled) .btn-icon {
  transform: translateX(4px);
}

.btn-glow {
  position: absolute;
  inset: 0;
  background: hsl(var(--foreground) / 0.9);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.submit-btn:hover:not(:disabled) .btn-glow {
  opacity: 1;
}

.submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, hsl(var(--background) / 0.1) 50%, transparent 100%);
  transition: left 0.6s ease;
}

.submit-btn:hover:not(:disabled)::before {
  left: 100%;
}

/* Form Footer */
.form-footer {
  margin-top: 2rem;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  position: relative;
  z-index: 1;
}

.link-highlight {
  color: hsl(var(--foreground));
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.3s ease;
  padding: 0.25rem 0.5rem;
  margin: -0.25rem -0.5rem;
  border-radius: 8px;
}

.link-highlight:hover {
  background: hsl(var(--accent));
}

.link-arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.3s ease;
}

.link-highlight:hover .link-arrow {
  transform: translateX(4px);
}

/* Float Animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}
</style>
