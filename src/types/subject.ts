export interface Subject {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
}

export interface Chapter {
  id: string
  subjectId: string
  name: string
  createdAt: number
  updatedAt: number
}
