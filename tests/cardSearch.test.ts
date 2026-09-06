import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createCardSearchIndex, normalizeSearchQuery } from '../src/utils/cardSearch'
import { searchCards } from '../src/services/cardService'
import { setStorage } from '../src/storage/storage'
import { STORAGE_KEYS } from '../src/storage/keys'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('indexed and service searches match all editable text and section titles', async () => {
  const card: KnowledgeCard = {
    id: 'search', subjectId: 'subject', question: 'What is CPU?', answer: '中央处理器',
    sectionTitle: '计算机基础', connection: '承接总线', note: '参考教材', tags: ['Hardware'],
    importance: 2, status: 'active', createdAt: 1, updatedAt: 1,
  }
  const index = createCardSearchIndex([card])
  await setStorage(STORAGE_KEYS.cards, [card])
  for (const query of ['  cpu ', '中央', '计算机基础', '总线', '教材', 'HARDWARE']) {
    assert.ok(index[0].text.includes(normalizeSearchQuery(query)), query)
    assert.ok((await searchCards(query)).some((item) => item.id === card.id), query)
  }
  assert.ok((await searchCards('  ')).some((item) => item.id === card.id))
  assert.deepEqual(await searchCards('does-not-exist-12345'), [])
  assert.equal(card.question, 'What is CPU?')
})
