import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  exportBackup,
  hasAutomaticBackup,
  importBackup,
  parseBackup,
  restoreAutomaticBackup,
  validateBackupData,
} from '../src/services/backupService'
import { createReviewState } from '../src/scheduler/fsrs'
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

function backupWithSubject(id: string, name: string) {
  return {
    version: 1 as const,
    subjects: [{ id, name, createdAt: 1, updatedAt: 1 }],
    chapters: [],
    cards: [],
    reviewStates: [],
    reviewLogs: [],
    settings: { dailyNewCards: 20, desiredRetention: 0.9, enableFuzz: true },
  }
}

test('backup validation rejects duplicate IDs and broken references', () => {
  const duplicateSubjects = backupWithSubject('subject_1', 'One')
  duplicateSubjects.subjects.push({
    id: 'subject_1',
    name: 'Duplicate',
    createdAt: 2,
    updatedAt: 2,
  })
  assert.equal(validateBackupData(duplicateSubjects), false)

  const orphanCard = {
    ...backupWithSubject('subject_1', 'One'),
    cards: [
      {
        id: 'card_1',
        subjectId: 'missing_subject',
        question: 'Question',
        answer: 'Answer',
        tags: [],
        importance: 2,
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }
  assert.equal(validateBackupData(orphanCard), false)
})

test('backup validation rejects corrupt or inconsistent FSRS state', () => {
  const subject = { id: 'subject_1', name: 'One', createdAt: 1, updatedAt: 1 }
  const card = {
    id: 'card_1',
    subjectId: subject.id,
    question: 'Question',
    answer: 'Answer',
    tags: [],
    importance: 2 as const,
    status: 'active' as const,
    createdAt: 1,
    updatedAt: 1,
  }
  const validState = createReviewState(card.id, new Date(2026, 6, 30, 12).getTime())
  const backup = {
    ...backupWithSubject(subject.id, subject.name),
    subjects: [subject],
    cards: [card],
    reviewStates: [validState],
  }

  assert.equal(validateBackupData(backup), true)
  assert.equal(
    validateBackupData({
      ...backup,
      reviewStates: [{ ...validState, fsrsData: {} }],
    }),
    false,
  )
  assert.equal(
    validateBackupData({
      ...backup,
      reviewStates: [{ ...validState, dueAt: validState.dueAt + 1 }],
    }),
    false,
  )
})

test('import creates a restorable snapshot of the previous data', async () => {
  const original = backupWithSubject('subject_original', 'Original')
  const replacement = backupWithSubject('subject_new', 'Replacement')
  await importBackup(JSON.stringify(original))
  await importBackup(JSON.stringify(replacement))

  assert.equal(await hasAutomaticBackup(), true)
  assert.deepEqual(readStored(STORAGE_KEYS.subjects), replacement.subjects)

  await restoreAutomaticBackup()
  assert.deepEqual(readStored(STORAGE_KEYS.subjects), original.subjects)
})
