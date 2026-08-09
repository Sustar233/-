import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { STORAGE_KEYS } from '../src/storage/keys'
import {
  getStorage,
  setStorage,
  setStorageBatch,
  shouldUseLanStorage,
} from '../src/storage/storage'
import {
  failNextSet,
  installStorageMock,
  readStored,
  resetStorage,
} from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('production H5 never depends on the development LAN storage API', () => {
  assert.equal(shouldUseLanStorage(false, true), false)
  assert.equal(shouldUseLanStorage(true, true), true)
  assert.equal(shouldUseLanStorage(true, false), false)
})

test('an interrupted local batch is completed before the next read', async () => {
  await setStorage(STORAGE_KEYS.reviewStates, [{ cardId: 'old' }])
  await setStorage(STORAGE_KEYS.reviewLogs, [{ id: 'old' }])
  failNextSet(STORAGE_KEYS.reviewLogs)

  await assert.rejects(() =>
    setStorageBatch([
      { type: 'set', key: STORAGE_KEYS.reviewStates, value: [{ cardId: 'new' }] },
      { type: 'set', key: STORAGE_KEYS.reviewLogs, value: [{ id: 'new' }] },
    ]),
  )

  assert.deepEqual(await getStorage(STORAGE_KEYS.reviewLogs), [{ id: 'new' }])
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [{ cardId: 'new' }])
  assert.equal(readStored('recalllab:pendingTransaction'), undefined)
})
