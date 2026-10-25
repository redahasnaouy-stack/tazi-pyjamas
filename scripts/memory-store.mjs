export class MemoryStore {
  constructor() {
    this.rows = new Map();
    this.sequence = 0;
  }
  async getWithMetadata(key) {
    const row = this.rows.get(key);
    return row ? structuredClone(row) : null;
  }
  async get(key) {
    return structuredClone(this.rows.get(key)?.data ?? null);
  }
  async setJSON(key, data, conditions = {}) {
    const current = this.rows.get(key);
    if (
      (conditions.onlyIfNew && current) ||
      (conditions.onlyIfMatch && current?.etag !== conditions.onlyIfMatch)
    )
      return { modified: false };
    const etag = String(++this.sequence);
    this.rows.set(key, { data: structuredClone(data), etag, metadata: {} });
    return { modified: true, etag };
  }
  async set(key, data, { metadata = {} } = {}) {
    const etag = String(++this.sequence);
    this.rows.set(key, { data: structuredClone(data), metadata, etag });
    return { modified: true, etag };
  }
  async *list() {
    yield { blobs: [...this.rows.keys()].map((key) => ({ key })) };
  }
}
