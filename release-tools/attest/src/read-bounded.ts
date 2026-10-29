import { constants } from 'fs'
import fs from 'fs/promises'

// Read the same open descriptor that was inspected, never reopen by pathname.
// The byte budget also holds if another process grows the open file.
export const readBounded = async (
  filePath: string,
  maximum: number,
  label: string
): Promise<string> => {
  const handle = await fs.open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  )
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error(`${label} file not found: ${filePath}`)
    const tooLarge = (): Error =>
      new Error(`${label} file exceeds maximum allowed size: ${maximum} bytes`)
    if (stat.size > maximum) throw tooLarge()
    const chunks: Buffer[] = []
    let total = 0
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, maximum + 1 - total))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      total += bytesRead
      if (total > maximum) throw tooLarge()
      chunks.push(buffer.subarray(0, bytesRead))
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    await handle.close()
  }
}
