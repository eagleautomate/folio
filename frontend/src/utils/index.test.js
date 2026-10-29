import { describe, expect, it, vi } from 'vitest'
import { debounce } from './index'

describe('debounce', () => {
  it('flush() runs a pending call with its latest args, once', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('a')
    d('b')
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1) // timer was cleared
  })
  it('flush() with nothing pending does nothing', () => {
    const fn = vi.fn()
    debounce(fn, 100).flush()
    expect(fn).not.toHaveBeenCalled()
  })
  it('flush(args) runs immediately with the given args', () => {
    const fn = vi.fn()
    debounce(fn, 100).flush('x')
    expect(fn).toHaveBeenCalledWith('x')
  })
})

describe('formatDateRange', async () => {
  const { formatDateRange } = await import('./index')
  const year = new Date().getFullYear()
  it('omits the current year and keeps other years', () => {
    expect(formatDateRange(`${year}-10-09`, `${year}-12-08`)).not.toContain(String(year))
    expect(formatDateRange(`${year}-10-24`, `${year + 1}-01-27`)).toContain(String(year + 1))
  })
  it('handles one-sided and empty ranges', () => {
    expect(formatDateRange(null, `${year}-12-08`)).toMatch(/^Due /)
    expect(formatDateRange(`${year}-12-08`, null)).toMatch(/^From /)
    expect(formatDateRange(null, null)).toBe('')
  })
})
