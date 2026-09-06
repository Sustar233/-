import type { KnowledgeCard } from '@/types/card'

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase()
}

/** Build once per dataset change, rather than joining every answer on each keystroke. */
export function createCardSearchIndex(cards: KnowledgeCard[]) {
  return cards.map((card) => ({
    card,
    text: normalizeSearchQuery([
      card.question, card.answer, card.sectionTitle ?? '',
      card.connection ?? '', card.note ?? '', ...card.tags,
    ].join(' ')),
  }))
}
