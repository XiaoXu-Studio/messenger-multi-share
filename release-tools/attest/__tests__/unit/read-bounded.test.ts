import { jest } from '@jest/globals'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { readBounded } from '../../src/read-bounded'

describe('bounded descriptor reads', () => {
  let directory: string
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'attest-bounded-'))
  })
  afterEach(async () => {
    jest.restoreAllMocks()
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('reads UTF-8 and rejects directories and oversized files', async () => {
    const file = path.join(directory, 'input')
    await fs.writeFile(file, '中文')
    expect(await readBounded(file, 6, 'test')).toBe('中文')
    await expect(readBounded(file, 5, 'test')).rejects.toThrow(
      /maximum allowed size/
    )
    await expect(readBounded(directory, 100, 'test')).rejects.toThrow()
  })

  it('bounds data even if the size changes after descriptor inspection', async () => {
    const file = path.join(directory, 'input')
    await fs.writeFile(file, '123456')
    const handle = await fs.open(file, 'r')
    const stat = await handle.stat()
    jest
      .spyOn(handle, 'stat')
      .mockResolvedValue({
        ...stat,
        size: 1,
        isFile: () => true
      })
    const close = jest.spyOn(handle, 'close')
    jest.spyOn(fs, 'open').mockResolvedValueOnce(handle)
    await expect(readBounded(file, 5, 'test')).rejects.toThrow(
      /maximum allowed size/
    )
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('never reopens a pathname for reading', async () => {
    const file = path.join(directory, 'input')
    await fs.writeFile(file, 'original')
    const open = jest.spyOn(fs, 'open')
    const readFile = jest.spyOn(fs, 'readFile')
    const stat = jest.spyOn(fs, 'stat')
    expect(await readBounded(file, 100, 'test')).toBe('original')
    expect(open).toHaveBeenCalledTimes(1)
    expect(readFile).not.toHaveBeenCalled()
    expect(stat).not.toHaveBeenCalled()
  })

  it('rejects final symlinks on the Linux publishing runner', async () => {
    if (process.platform === 'win32') return
    const file = path.join(directory, 'input')
    const link = path.join(directory, 'link')
    await fs.writeFile(file, 'data')
    await fs.symlink(file, link)
    await expect(readBounded(link, 100, 'test')).rejects.toThrow()
  })
})
