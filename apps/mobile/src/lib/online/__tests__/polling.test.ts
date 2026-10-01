import { afterEach, describe, expect, it, vi } from 'vitest';
import { PollingController } from '../polling';

afterEach(() => vi.useRealTimers());
const flush = () => Promise.resolve().then(() => Promise.resolve());
describe('foreground polling', () => {
  it('fetches immediately, respects the interval and stops in the background', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => {});
    const poll = new PollingController(3000, fetch, vi.fn());
    poll.start(); await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(2);
    poll.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2);
    poll.start(); await flush();
    expect(fetch).toHaveBeenCalledTimes(3);
    poll.stop();
  });
  it('coalesces refreshes without overlapping requests', async () => {
    let resolve!: () => void;
    const fetch = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const poll = new PollingController(3000, fetch, vi.fn());
    poll.start(); poll.refresh(); poll.refresh();
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(); await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    poll.stop(); resolve(); await flush();
  });
  it('aborts obsolete fetches and suppresses errors after navigation', async () => {
    let reject!: (e: unknown) => void;
    let signal!: AbortSignal;
    const error = vi.fn();
    const poll = new PollingController(3000, async s => { signal = s; await new Promise((_, fail) => { reject = fail; }); }, error);
    poll.start(); poll.stop();
    expect(signal.aborted).toBe(true);
    reject(new Error('aborted')); await flush();
    expect(error).not.toHaveBeenCalled();
  });
  it('recovers automatically after a network failure', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const poll = new PollingController(10000, fetch, error);
    poll.start(); await flush();
    expect(error).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2);
    poll.stop();
  });
});
