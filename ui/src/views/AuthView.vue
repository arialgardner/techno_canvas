<template>
  <div class="auth-container theme-win98">
    <div class="window auth-card">
      <div class="inner">
        <div class="header">
          <span class="title">CollabCanvas - Authentication</span>
        </div>

        <div class="content">
          <!-- Toggle between Login/Signup -->
          <div class="auth-toggle">
            <button 
              :class="{ active: !isSignupMode }" 
              @click="isSignupMode = false"
              type="button"
            >
              Login
            </button>
            <button 
              :class="{ active: isSignupMode }" 
              @click="isSignupMode = true"
              type="button"
            >
              Sign Up
            </button>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- Auth Form -->
          <form @submit.prevent="handleSubmit" class="auth-form" :class="{ 'login-mode': !isSignupMode }">
            <!-- Display Name Field (Signup only) -->
            <div v-if="isSignupMode" class="form-group display-name-group">
              <label for="displayName">Display Name:</label>
              <input
                id="displayName"
                v-model="form.displayName"
                type="text"
                required
                :disabled="isLoading"
              />
              <div class="field-error" :class="{ visible: displayNameError }">{{ displayNameError || '&nbsp;' }}</div>
            </div>

            <!-- Email Field -->
            <div class="form-group">
              <label for="email">Email:</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                required
                :disabled="isLoading"
              />
              <div class="field-error" :class="{ visible: emailError }">{{ emailError || '&nbsp;' }}</div>
            </div>

            <!-- Password Field -->
            <div class="form-group">
              <label for="password">Password:</label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                required
                :disabled="isLoading"
              />
              <div class="field-error" :class="{ visible: passwordError }">{{ passwordError || '&nbsp;' }}</div>
            </div>

            <!-- Submit Button -->
            <button 
              type="submit" 
              :disabled="isLoading || !isFormValid"
              class="auth-button primary"
            >
              <span v-if="isLoading" class="loading-spinner"></span>
              {{ isLoading ? 'Please wait...' : (isSignupMode ? 'Create Account' : 'Sign In') }}
            </button>
          </form>

          <!-- Divider -->
          <div class="divider">
            <span>or</span>
          </div>

          <!-- Google Sign In -->
          <button 
            @click="handleGoogleAuth"
            :disabled="isLoading"
            type="button"
            class="auth-button google"
          >
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {{ isSignupMode ? 'Sign up with Google' : 'Sign in with Google' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'

export default {
  name: 'AuthView',
  setup() {
    const { signUp, signUpWithGoogle, signIn, signInWithGoogle, isLoading, error, user } = useAuth()
    const router = useRouter()

    // Form state
    const isSignupMode = ref(false)
    const form = ref({
      displayName: '',
      email: '',
      password: ''
    })

    // Validation
    const emailError = ref('')
    const passwordError = ref('')
    const displayNameError = ref('')

    // Validate email format
    const validateEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }

    // Validate password length
    const validatePassword = (password) => {
      return password.length >= 6
    }

    // Validate display name
    const validateDisplayName = (name) => {
      return name.trim().length >= 2
    }

    // Form validation
    const isFormValid = computed(() => {
      const emailValid = validateEmail(form.value.email)
      const passwordValid = validatePassword(form.value.password)
      const displayNameValid = !isSignupMode.value || validateDisplayName(form.value.displayName)
      
      return emailValid && passwordValid && displayNameValid
    })

    // Watch form fields for real-time validation
    watch(() => form.value.email, (newEmail) => {
      if (newEmail && !validateEmail(newEmail)) {
        emailError.value = 'Please enter a valid email address'
      } else {
        emailError.value = ''
      }
    })

    watch(() => form.value.password, (newPassword) => {
      if (newPassword && !validatePassword(newPassword)) {
        passwordError.value = 'Password must be at least 6 characters'
      } else {
        passwordError.value = ''
      }
    })

    watch(() => form.value.displayName, (newName) => {
      if (isSignupMode.value && newName && !validateDisplayName(newName)) {
        displayNameError.value = 'Display name must be at least 2 characters'
      } else {
        displayNameError.value = ''
      }
    })

    // Clear form when switching modes
    watch(isSignupMode, () => {
      form.value = {
        displayName: '',
        email: '',
        password: ''
      }
      emailError.value = ''
      passwordError.value = ''
      displayNameError.value = ''
    })

    // Handle form submission
    const handleSubmit = async () => {
      try {
        if (isSignupMode.value) {
          await signUp(form.value.email, form.value.password, form.value.displayName)
        } else {
          await signIn(form.value.email, form.value.password)
        }
        
        // Redirect to canvas on successful auth
        router.push('/canvas')
      } catch (err) {
        // Error is handled by useAuth composable
        console.error('Auth error:', err)
      }
    }

    // Handle Google authentication
    const handleGoogleAuth = async () => {
      try {
        if (isSignupMode.value) {
          await signUpWithGoogle()
        } else {
          await signInWithGoogle()
        }
        
        // Redirect to canvas on successful auth
        router.push('/canvas')
      } catch (err) {
        // Error is handled by useAuth composable
        console.error('Google auth error:', err)
      }
    }

    // Redirect if already authenticated
    watch(user, (newUser) => {
      if (newUser) {
        router.push('/canvas')
      }
    }, { immediate: true })

    return {
      isSignupMode,
      form,
      isLoading,
      error,
      emailError,
      passwordError,
      displayNameError,
      isFormValid,
      handleSubmit,
      handleGoogleAuth
    }
  }
}
</script>

<style lang="scss" scoped>
.auth-container {
  min-height: 100vh;
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #008080;
  padding: 20px;
  overflow: hidden;
}

.auth-card {
  width: 100%;
  max-width: 450px;
  min-width: 320px;
}

.auth-toggle {
  display: flex;
  margin-bottom: 12px;
  gap: 6px;

  button {
    flex: 1;
    padding: 6px 12px;
    
    &.active {
      box-shadow: 1px 1px 0 0 black inset, inset 0 0 0 1px #808080;
    }
  }
}

.error-message {
  padding: 8px;
  margin-bottom: 12px;
  border: 2px solid #000;
  background: #fff0f0;
  color: #c00;
  box-shadow: inset -1px 0px 0 0 #808080, inset -1px 1px 0 0 #ffffff, inset -1px -1px 0 0 #808080, inset 0px 0px 0 1px #ffffff;
}

.auth-form {
  margin-bottom: 12px;

  &.login-mode {
    min-height: 240px;
  }
}

.form-group {
  margin-bottom: 12px;

  label {
    display: block;
    margin-bottom: 4px;
  }

  input {
    width: 100%;
    box-sizing: border-box;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.field-error {
  font-size: 10px;
  margin-top: 2px;
  min-height: 14px;
  color: transparent;
  
  &.visible {
    color: #c00;
  }
}

.auth-button {
  width: 100%;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &.primary {
    margin-bottom: 6px;
  }

  &:disabled {
    opacity: 0.6;
  }
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.divider {
  text-align: center;
  margin: 10px 0;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: #808080;
  }
}

.google-icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 400px) {
  .auth-card {
    min-width: 280px;
  }
}
</style>
