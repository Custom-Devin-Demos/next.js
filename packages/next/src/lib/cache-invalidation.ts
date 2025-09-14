import { promises as fs } from 'fs'
import { join } from 'path'

export async function invalidateESLintCache(cacheDir: string): Promise<void> {
  try {
    const eslintCacheDir = join(cacheDir, 'eslint')
    const files = await fs.readdir(eslintCacheDir)

    for (const file of files) {
      if (file.endsWith('.cache')) {
        await fs.unlink(join(eslintCacheDir, file))
      }
    }
  } catch (error) {
    console.warn('Failed to invalidate ESLint cache:', (error as Error).message)
  }
}

export async function invalidateTypeScriptCache(
  projectDir: string
): Promise<void> {
  try {
    const tsBuildInfoPath = join(projectDir, 'tsconfig.tsbuildinfo')
    await fs.unlink(tsBuildInfoPath)
  } catch (error) {}
}
