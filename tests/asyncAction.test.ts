import assert from 'node:assert/strict'
import { test } from 'node:test'
import { useAsyncAction } from '../src/composables/useAsyncAction'
import { installStorageMock } from './helpers/storageMock'

installStorageMock()

test('overlapping page actions execute once and unlock after completion', async () => {
  const action = useAsyncAction()
  let release!: () => void
  let calls = 0
  const first = action.run(async () => {
    calls += 1
    await new Promise<void>((resolve) => { release = resolve })
  })
  assert.equal(action.running.value, true)
  assert.equal(await action.run(async () => { calls += 1 }), false)
  assert.equal(calls, 1)
  release()
  assert.equal(await first, true)
  assert.equal(action.running.value, false)
  assert.equal(await action.run(async () => { calls += 1 }), true)
  assert.equal(calls, 2)
})

test('failed actions report native storage errors and allow retry', async () => {
  const messages: string[] = []
  Object.assign(uni, { showToast: ({ title }: { title: string }) => messages.push(title) })
  const action = useAsyncAction()
  for (const error of [new Error('保存失败'), { errMsg: '磁盘空间不足' }, null]) {
    assert.equal(await action.run(async () => { throw error }), false)
    assert.equal(action.running.value, false)
  }
  assert.deepEqual(messages, ['保存失败', '磁盘空间不足', '操作失败，请重试'])
  assert.equal(await action.run(async () => undefined), true)
})
