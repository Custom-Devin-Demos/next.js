export async function withCacheTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 30000,
  cacheInvalidator?: () => Promise<void>
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Cache operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation(), timeoutPromise])
  } catch (error) {
    if (
      cacheInvalidator &&
      error instanceof Error &&
      error.message.includes('timed out')
    ) {
      await cacheInvalidator()
    }
    throw error
  }
}
