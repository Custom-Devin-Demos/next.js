import fs from 'fs-extra'
import { join } from 'path'
import { nextLint } from 'next-test-utils'

const testDir = join(__dirname, '../cache-timeout-fixture')

describe('ESLint Cache Timeout', () => {
  beforeEach(async () => {
    const cacheDir = join(testDir, '.next', 'cache', 'eslint')
    await fs.ensureDir(cacheDir)
    await fs.remove(cacheDir)
  })

  test('lint completes with cache timeout mechanisms', async () => {
    const cacheDir = join(testDir, '.next', 'cache')

    await fs.remove(cacheDir)
    const { code } = await nextLint(testDir, [], {
      stdout: true,
      stderr: true,
    })

    expect(code).toBe(0)

    const files = await fs.readdir(join(cacheDir, 'eslint/'))
    const cacheExists = files.some((f) => f.startsWith('.cache'))
    expect(cacheExists).toBe(true)
  })

  test('cache invalidation works correctly', async () => {
    const cacheDir = join(testDir, '.next', 'cache', 'eslint')

    await fs.remove(cacheDir)
    await nextLint(testDir, [])

    const files = await fs.readdir(cacheDir)
    expect(files.some((f) => f.startsWith('.cache'))).toBe(true)

    const cacheFile = files.find((f) => f.startsWith('.cache'))
    await fs.writeFile(join(cacheDir, cacheFile), 'corrupted')

    const { code } = await nextLint(testDir, [])
    expect(code).toBe(0)
  })
})
