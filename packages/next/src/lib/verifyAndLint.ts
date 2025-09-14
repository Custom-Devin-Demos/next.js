import { red } from './picocolors'
import { Worker } from './worker'
import { existsSync } from 'fs'
import { join } from 'path'
import { ESLINT_DEFAULT_DIRS } from './constants'
import type { Telemetry } from '../telemetry/storage'
import { eventLintCheckCompleted } from '../telemetry/events'
import { CompileError } from './compile-error'
import isError from './is-error'
import { withCacheTimeout } from './safe-cache-operations'
import { invalidateESLintCache } from './cache-invalidation'

export async function verifyAndLint(
  dir: string,
  cacheLocation: string,
  configLintDirs: string[] | undefined,
  enableWorkerThreads: boolean | undefined,
  telemetry: Telemetry
): Promise<void> {
  let lintWorkers:
    | (Worker & {
        runLintCheck: typeof import('./eslint/runLintCheck').runLintCheck
      })
    | undefined
  const timeoutMs = 60000 // 1 minute timeout

  try {
    await withCacheTimeout(
      async () => {
        lintWorkers = new Worker(require.resolve('./eslint/runLintCheck'), {
          exposedMethods: ['runLintCheck'],
          debuggerPortOffset: -1,
          isolatedMemory: false,
          numWorkers: 1,
          enableWorkerThreads,
          maxRetries: 0,
          forkOptions: {
            env: {
              ...process.env,
              ESLINT_CACHE_TIMEOUT: timeoutMs.toString(),
            },
          },
        }) as Worker & {
          runLintCheck: typeof import('./eslint/runLintCheck').runLintCheck
        }

        const lintDirs = (configLintDirs ?? ESLINT_DEFAULT_DIRS).reduce(
          (res: string[], d: string) => {
            const currDir = join(dir, d)
            if (!existsSync(currDir)) return res
            res.push(currDir)
            return res
          },
          []
        )

        const lintResults = await lintWorkers?.runLintCheck(dir, lintDirs, {
          lintDuringBuild: true,
          eslintOptions: {
            cacheLocation,
          },
        })
        const lintOutput =
          typeof lintResults === 'string' ? lintResults : lintResults?.output

        if (typeof lintResults !== 'string' && lintResults?.eventInfo) {
          telemetry.record(
            eventLintCheckCompleted({
              ...lintResults.eventInfo,
              buildLint: true,
            })
          )
        }

        if (
          typeof lintResults !== 'string' &&
          lintResults?.isError &&
          lintOutput
        ) {
          await telemetry.flush()
          throw new CompileError(lintOutput)
        }

        if (lintOutput) {
          console.log(lintOutput)
        }
      },
      timeoutMs,
      () => invalidateESLintCache(cacheLocation)
    )
  } catch (err) {
    if (isError(err)) {
      if (err.type === 'CompileError' || err instanceof CompileError) {
        console.error(red('\nFailed to compile.'))
        console.error(err.message)
        process.exit(1)
      } else if (err.type === 'FatalError') {
        console.error(err.message)
        process.exit(1)
      }
    }
    throw err
  } finally {
    if (lintWorkers) {
      try {
        await lintWorkers.end()
      } catch (error) {
        console.warn(
          'Failed to properly terminate lint worker:',
          (error as Error).message
        )
        const worker = (lintWorkers as any).getWorker?.()
        if (worker?.kill) {
          worker.kill('SIGKILL')
        }
      }
    }
  }
}
