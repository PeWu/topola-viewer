import { defineConfig } from 'cypress'

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 1024,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: 'http://localhost:3000/#',
    supportFile: false,
  },
})
