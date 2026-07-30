import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createChapter,
  createSubject,
  deleteChapter,
  deleteSubject,
  getChapters,
  getSubjects,
  updateChapter,
  updateSubject,
} from '@/services/subjectService'
import type { Chapter, Subject } from '@/types/subject'

export const useSubjectStore = defineStore('subjects', () => {
  const subjects = ref<Subject[]>([])
  const chapters = ref<Chapter[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
    } finally {
      loading.value = false
    }
  }

  async function addSubject(name: string, description?: string): Promise<void> {
    await createSubject(name, description)
    await load()
  }

  async function editSubject(id: string, name: string, description?: string): Promise<void> {
    await updateSubject(id, { name, description })
    await load()
  }

  async function removeSubject(id: string): Promise<void> {
    await deleteSubject(id)
    await load()
  }

  async function addChapter(subjectId: string, name: string): Promise<void> {
    await createChapter(subjectId, name)
    await load()
  }

  async function editChapter(id: string, name: string): Promise<void> {
    await updateChapter(id, name)
    await load()
  }

  async function removeChapter(id: string): Promise<void> {
    await deleteChapter(id)
    await load()
  }

  return {
    subjects,
    chapters,
    loading,
    load,
    addSubject,
    editSubject,
    removeSubject,
    addChapter,
    editChapter,
    removeChapter,
  }
})
