import { spawn } from 'node:child_process'
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stagingDir = path.join(projectRoot, 'dist', '.mp-weixin-stage')
const outputDir = path.join(projectRoot, 'dist', 'build', 'mp-weixin')
const uniCli = path.join(
  projectRoot,
  'node_modules',
  '@dcloudio',
  'vite-plugin-uni',
  'bin',
  'uni.js',
)
const preservedOutputFiles = new Set(['project.private.config.json'])

function runUniBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [uniCli, 'build', '-p', 'mp-weixin'], {
      cwd: projectRoot,
      env: { ...process.env, UNI_OUTPUT_DIR: stagingDir },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`微信小程序构建失败（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`))
    })
  })
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(rootDir, absolutePath)))
    else if (entry.isFile()) files.push(path.relative(rootDir, absolutePath))
  }
  return files
}

async function replaceFile(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.recalllab-${process.pid}.tmp`
  await copyFile(source, temporary)
  await rename(temporary, destination)
}

async function removeEmptyDirectories(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirectories(rootDir, path.join(currentDir, entry.name))
    }
  }
  if (currentDir !== rootDir && (await readdir(currentDir)).length === 0) {
    await rm(currentDir, { recursive: true })
  }
}

async function publishStagedBuild() {
  await mkdir(outputDir, { recursive: true })
  const [stagedFiles, existingFiles] = await Promise.all([
    listFiles(stagingDir),
    listFiles(outputDir),
  ])
  const stagedSet = new Set(stagedFiles)

  // Replace complete files without ever removing app.json. This prevents an open
  // WeChat DevTools instance from observing a half-built mini-program package.
  for (const relativePath of stagedFiles) {
    await replaceFile(
      path.join(stagingDir, relativePath),
      path.join(outputDir, relativePath),
    )
  }

  for (const relativePath of existingFiles) {
    if (stagedSet.has(relativePath) || preservedOutputFiles.has(relativePath)) continue
    await rm(path.join(outputDir, relativePath))
  }
  await removeEmptyDirectories(outputDir)
}

await rm(stagingDir, { recursive: true, force: true })
try {
  await runUniBuild()
  const appJson = path.join(stagingDir, 'app.json')
  if (!(await stat(appJson)).isFile()) throw new Error('暂存构建缺少 app.json，已停止发布')
  await publishStagedBuild()
  console.log(`微信小程序构建已安全发布到 ${path.relative(projectRoot, outputDir)}`)
} finally {
  await rm(stagingDir, { recursive: true, force: true })
}
