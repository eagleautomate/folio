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
