/** One request at a time, immediate refresh on resume, and no late work after stop. */
export class PollingController {
  private active = false;
  private running = false;
  private queued = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  constructor(private interval: number, private fetch: (signal: AbortSignal) => Promise<void>, private onError: (error: unknown) => void) {}
  start(): void { this.active = true; this.refresh(); }
  stop(): void {
    this.active = false;
    this.queued = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
  }
  refresh(): void {
    if (!this.active) return;
    if (this.running) { this.queued = true; return; }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.run();
  }
  private async run(): Promise<void> {
    this.running = true;
    const controller = new AbortController();
    this.controller = controller;
    try { await this.fetch(controller.signal); }
    catch (error) { if (!controller.signal.aborted && this.active) this.onError(error); }
    finally {
      this.running = false;
      this.controller = null;
      if (this.active) {
        if (this.queued) { this.queued = false; this.refresh(); }
        else this.timer = setTimeout(() => this.refresh(), this.interval);
      }
    }
  }
}
