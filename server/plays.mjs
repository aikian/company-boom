// Play counter: one bucket per KST calendar day in /data/plays.json.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const kstDate = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);

export function summarize(buckets, now = Date.now()) {
  const today = kstDate(now); const month = today.slice(0, 7);
  let total = 0, thisMonth = 0;
  for (const [date, count] of Object.entries(buckets)) { total += count; if (date.startsWith(month)) thisMonth += count; }
  return { today: buckets[today] || 0, month: thisMonth, total, monthLabel: month };
}

export function createPlays({ dataDir }) {
  const FILE = join(dataDir, 'plays.json');
  let buckets = {}; let saving = Promise.resolve(); let dirty = false;
  async function load() { try { buckets = JSON.parse(await readFile(FILE, 'utf8')); if (!buckets || typeof buckets !== 'object') buckets = {}; } catch { buckets = {}; } }
  function persist() {
    if (!dirty) return saving; dirty = false;
    const snapshot = JSON.stringify(buckets);
    saving = saving.then(async () => { await mkdir(dataDir, { recursive: true }); await writeFile(`${FILE}.tmp`, snapshot); await rename(`${FILE}.tmp`, FILE); }).catch(error => console.error('Could not save plays', error));
    return saving;
  }
  return {
    load,
    record(now = Date.now()) { const day = kstDate(now); buckets[day] = (buckets[day] || 0) + 1; dirty = true; return summarize(buckets, now); },
    summary: (now = Date.now()) => summarize(buckets, now),
    // Writes are batched: a busy evening should not hit the disk on every tap of "start".
    start: () => setInterval(() => persist(), 5000),
    flush: persist,
  };
}
