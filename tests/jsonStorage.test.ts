import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { JsonStorage } from '../server/jsonStorage'

test('shared JSON storage persists values across instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recalllab-storage-'))
  const filePath = join(directory, 'storage.json')

  try {
    const first = new JsonStorage(filePath)
    assert.deepEqual(await first.get('recalllab:cards'), { found: false })
    await first.set('recalllab:cards', [{ id: 'card_1' }])

    const second = new JsonStorage(filePath)
    assert.deepEqual(await second.get('recalllab:cards'), {
      found: true,
      value: [{ id: 'card_1' }],
    })
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
      'recalllab:cards': [{ id: 'card_1' }],
    })

    await second.batch([
      { type: 'set', key: 'recalllab:cards', value: [{ id: 'card_2' }] },
      { type: 'set', key: 'recalllab:settings', value: { dailyNewCards: 10 } },
    ])
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), {
      'recalllab:cards': [{ id: 'card_2' }],
      'recalllab:settings': { dailyNewCards: 10 },
    })

    await second.remove('recalllab:cards')
    assert.deepEqual(await second.get('recalllab:cards'), { found: false })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
