import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { lanStoragePlugin } from './server/lanStoragePlugin'

export default defineConfig({
  plugins: [
    ...(process.env.UNI_PLATFORM === 'h5' ? [lanStoragePlugin()] : []),
    uni(),
  ],
})
