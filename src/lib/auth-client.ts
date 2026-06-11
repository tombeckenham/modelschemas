import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'
import { apiKeyClient } from '@better-auth/api-key/client'

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), apiKeyClient()],
})
