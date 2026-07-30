import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { lanStoragePlugin } from './server/lanStoragePlugin'

export default defineConfig({
  plugins: [lanStoragePlugin(), uni()],
})
