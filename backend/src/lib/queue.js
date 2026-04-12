/**
 * FinansRadar — Bull MQ Queue Sistemi
 * Redis OLMADAN çalışan basit in-process queue fallback
 * Redis varsa Bull MQ kullanır, yoksa doğrudan çalıştırır
 */

// ─── Job Store (durum takibi için) ────────────────────────────────────────
const jobStore = new Map();
let jobCounter = 0;

function makeJobId() {
  return `job_${Date.now()}_${++jobCounter}`;
}

// ─── Simple Job ────────────────────────────────────────────────────────────
class SimpleJob {
  constructor(id, name, data) {
    this.id = id;
    this.name = name;
    this.data = data;
    this.status = 'waiting'; // waiting | active | completed | failed
    this.result = null;
    this.error = null;
    this.createdAt = new Date();
    this.completedAt = null;
    this.attempts = 0;
    this.maxAttempts = 3;
  }
}

// ─── Simple Queue (in-process) ─────────────────────────────────────────────
class SimpleQueue {
  constructor(name) {
    this.name = name;
    this.processor = null;
    this.queue = [];
    this.processing = false;
  }

  async add(name, data = {}, opts = {}) {
    const job = new SimpleJob(makeJobId(), name, data);
    jobStore.set(job.id, job);
    this.queue.push(job);
    // asenkron çalıştır
    setTimeout(() => this._process(), 0);
    return job;
  }

  process(concurrency, fn) {
    this.processor = typeof fn === 'function' ? fn : concurrency;
  }

  async _process() {
    if (this.processing || !this.processor || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      job.status = 'active';
      job.attempts++;

      try {
        job.result = await this.processor(job);
        job.status = 'completed';
        job.completedAt = new Date();
      } catch (err) {
        if (job.attempts < job.maxAttempts) {
          job.status = 'waiting';
          this.queue.push(job); // retry
          await new Promise(r => setTimeout(r, 1000 * job.attempts)); // backoff
        } else {
          job.status = 'failed';
          job.error = err.message;
          job.completedAt = new Date();
        }
      }
    }
    this.processing = false;
  }

  async getJob(id) { return jobStore.get(id) || null; }
  async getCompleted() { return [...jobStore.values()].filter(j => j.name === this.name && j.status === 'completed'); }
  async getFailed()    { return [...jobStore.values()].filter(j => j.name === this.name && j.status === 'failed'); }
  async getActive()    { return [...jobStore.values()].filter(j => j.name === this.name && j.status === 'active'); }
  async getWaiting()   { return [...jobStore.values()].filter(j => j.name === this.name && j.status === 'waiting'); }

  async clean(grace = 0, status = 'completed') {
    const now = Date.now();
    for (const [id, job] of jobStore.entries()) {
      if (job.status === status && job.completedAt && (now - job.completedAt.getTime()) > grace) {
        jobStore.delete(id);
      }
    }
  }
}

// ─── Queue örnekleri ───────────────────────────────────────────────────────
export const stockScannerQueue  = new SimpleQueue('stock-scanner');
export const analysisQueue      = new SimpleQueue('analysis');
export const notificationQueue  = new SimpleQueue('notifications');

// ─── Job durum sorgulama ──────────────────────────────────────────────────
export async function getJobStatus(jobId) {
  const job = jobStore.get(jobId);
  if (!job) return null;
  return {
    id:          job.id,
    name:        job.name,
    status:      job.status,
    attempts:    job.attempts,
    result:      job.result,
    error:       job.error,
    createdAt:   job.createdAt,
    completedAt: job.completedAt,
  };
}

// ─── Queue istatistikleri ──────────────────────────────────────────────────
export function queueStats() {
  const all = [...jobStore.values()];
  return {
    total:     all.length,
    waiting:   all.filter(j => j.status === 'waiting').length,
    active:    all.filter(j => j.status === 'active').length,
    completed: all.filter(j => j.status === 'completed').length,
    failed:    all.filter(j => j.status === 'failed').length,
  };
}

export { jobStore };
