import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { exportBackup, importBackup, parseBackup, validateBackupData } from '../src/services/backupService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('exported backup passes structural validation', async () => {
  await setStorage(STORAGE_KEYS.subjects, [
    { id: 'subject_1', name: 'Operating Systems', createdAt: 1, updatedAt: 1 },
  ])
  const json = await exportBackup()
  const data = JSON.parse(json)

  assert.equal(validateBackupData(data), true)
  assert.equal(parseBackup(json).version, 1)
})

test('invalid JSON never changes existing data', async () => {
  const existing = [{ id: 'subject_1', name: 'Keep me', createdAt: 1, updatedAt: 1 }]
  await setStorage(STORAGE_KEYS.subjects, existing)

  await assert.rejects(() => importBackup('{broken'), /当前数据未更改/)
  assert.deepEqual(readStored(STORAGE_KEYS.subjects), existing)
})

test('wrong backup shape is rejected before any write', async () => {
  const existing = [{ id: 'subject_1', name: 'Keep me', createdAt: 1, updatedAt: 1 }]
  await setStorage(STORAGE_KEYS.subjects, existing)

  await assert.rejects(
    () => importBackup(JSON.stringify({ version: 1, subjects: [] })),
    /当前数据未更改/,
  )
  assert.deepEqual(readStored(STORAGE_KEYS.subjects), existing)
})
