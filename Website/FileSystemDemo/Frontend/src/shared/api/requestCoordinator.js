const transient = new Set([429, 502, 503, 504])
const permanentCodes = new Set(['validation_error', 'invalid_request', 'revision_conflict', 'management_disabled', 'unauthorized', 'forbidden'])
export const aborted = () => new DOMException('The request was canceled.', 'AbortError')
const failure = (message, code) => Object.assign(new Error(message), { code })
export function retryAfter(value, now = Date.now()) {
  if (!value) return 0
  const seconds = /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now
  return Number.isFinite(seconds) ? Math.min(3000, Math.max(0, seconds)) : 0
}
export function isTransient(error) {
  return error?.name !== 'AbortError' && !permanentCodes.has(error?.code) && (transient.has(error?.status) || error?.code === 'transport_unavailable')
}

// One instance per independently built File-System app. No settled-result cache.
export function createRequestCoordinator({ interval = 600, capacity = 32, deadline = 20000, attempts = 3, backoff = 400, random = Math.random, now = Date.now } = {}) {
  const jobs = new Set(), reads = new Map()
  let active = null, wake = null, nextStart = 0
  const schedule = () => {
    clearTimeout(wake); wake = null
    if (active || !jobs.size) return
    const queued = [...jobs].filter(j => j.state === 'queued')
    if (!queued.length) return
    const time = now(), ready = queued.filter(j => j.readyAt <= time)
    if (!ready.length || time < nextStart) {
      wake = setTimeout(schedule, Math.max(1, Math.max(nextStart, Math.min(...queued.map(j => j.readyAt))) - time)); return
    }
    // Old work eventually wins; explicit actions can pass young background work.
    ready.sort((a, b) => (time - a.created >= 1500 ? 0 : 1) - (time - b.created >= 1500 ? 0 : 1) ||
      (time - a.created >= 1500 && time - b.created >= 1500 ? a.created - b.created : b.priority - a.priority) || a.order - b.order)
    const job = ready[0]
    if (time >= job.expiresAt) { job.expire(); return }
    if (!job.valid()) { finish(job, aborted()); schedule(); return }
    active = job; job.state = 'active'; job.started = true; job.count++; nextStart = time + interval
    // Defer dispatch one microtask so StrictMode's discarded subscriber can cancel.
    Promise.resolve().then(() => {
      if (!jobs.has(job) || job.controller.signal.aborted || !job.valid()) throw aborted()
      return job.run(job.controller.signal, metadata => { job.lastError = metadata })
    }).then(value => finish(job, null, value), error => {
      if (!jobs.has(job)) return
      job.lastError = error
      if (job.read && isTransient(error) && job.count < attempts && job.valid() && !job.controller.signal.aborted) {
        job.state = 'queued'
        job.readyAt = now() + Math.max(Math.min(3000, error.retryAfter || 0), Math.min(4000, backoff * 2 ** (job.count - 1) * (0.75 + random() / 2)))
      } else finish(job, error)
    }).finally(() => { if (active === job) active = null; schedule() })
  }
  function finish(job, error, value) {
    if (!jobs.delete(job)) return
    if (error && !job.read && job.started && (error.name === 'AbortError' || error.code === 'request_deadline' || isTransient(error))) error.uncertainWrite = true
    clearTimeout(job.timer)
    if (job.key && reads.get(job.key) === job) reads.delete(job.key)
    if (error && !job.controller.signal.aborted) job.controller.abort()
    for (const subscriber of job.subscribers) {
      subscriber.signal?.removeEventListener('abort', subscriber.cancel)
      if (error) subscriber.reject(error); else subscriber.resolve(value)
    }
    job.subscribers.clear()
  }
  let order = 0
  function request({ key, read = true, signal, valid = () => true, run, priority = read ? 0 : 1 }) {
    if (signal?.aborted || !valid()) return Promise.reject(aborted())
    let job = read && key ? reads.get(key) : null
    if (job?.subscribers.size >= capacity) return Promise.reject(failure('Too many pending readers. Wait, then retry.', 'request_queue_full'))
    if (!job) {
      if (jobs.size >= capacity) return Promise.reject(failure('Too many pending requests. Wait for current work, then retry.', 'request_queue_full'))
      job = { key: read ? key : null, read, run, valid, priority, controller: new AbortController(), subscribers: new Set(), state: 'queued', created: now(), expiresAt: now() + deadline, readyAt: now(), count: 0, order: order++ }
      jobs.add(job); if (job.key) reads.set(job.key, job)
      job.expire = () => {
        const error = Object.assign(failure('The request deadline was reached. Retry when the service is available.', 'request_deadline'), { requestId: job.lastError?.requestId, status: job.lastError?.status, responseStatus: job.lastError?.responseStatus, uncertainWrite: !job.read && job.started })
        finish(job, error)
        // Abort normally settles fetch; release even a broken transport/body reader.
        if (active === job) active = null
        schedule()
      }
      job.timer = setTimeout(job.expire, deadline)
    }
    const selected = job
    const promise = new Promise((resolve, reject) => {
      const subscriber = { resolve, reject, signal }
      subscriber.cancel = () => {
        if (!selected.subscribers.delete(subscriber)) return
        signal?.removeEventListener('abort', subscriber.cancel); reject(Object.assign(aborted(), { uncertainWrite: !selected.read && Boolean(selected.started) }))
        if (!selected.subscribers.size) {
          finish(selected, aborted())
          if (active === selected) active = null
          schedule()
        }
      }
      selected.subscribers.add(subscriber); signal?.addEventListener('abort', subscriber.cancel, { once: true })
    })
    // Starting asynchronously permits equivalent same-turn callers to subscribe.
    queueMicrotask(schedule)
    return promise
  }
  function invalidate() {
    for (const job of [...jobs]) if (!job.valid()) {
      finish(job, aborted()); if (active === job) active = null
    }
    schedule()
  }
  return { request, invalidate }
}
