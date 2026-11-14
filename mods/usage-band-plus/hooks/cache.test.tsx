import { expect, test } from 'claude-code/testing'

const NOW = 10_000_000
const BAND = {
  plugin: 'usage-band-plus',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const seed = (cacheAgoMs: number | null) => ({
  snapshot: {
    contextPercent: 6,
    contextTokens: 59_000,
    contextWindow: 1_000_000,
    limits: [{ kind: 'five_hour', percentUsed: 20, resetsAt: null }],
  },
  cacheAt: cacheAgoMs === null ? null : NOW - cacheAgoMs,
  cacheTtl: '1h',
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setup = (on: (...args: any[]) => unknown, cacheAgoMs: number | null) => {
  const values: Record<string, unknown> = seed(cacheAgoMs)
  on('clock.now', () => ({ value: NOW }))
  on('state.get', (_: unknown, e: { key: string }, next: (e: unknown) => unknown) => {
    const key = e.key
    return key in values ? { value: { value: values[key], version: 1 } } : next(e)
  })
}

// 칸 하나의 내용이 왼쪽·오른쪽 여백이 같은지: 마지막 칸(Cache)을 잘라 본다.
const lastCell = (line: string): string => {
  const parts = line.split('│')
  return parts[parts.length - 2] ?? ''
}

const balanced = (cell: string): boolean => {
  const left = cell.length - cell.trimStart().length
  const right = cell.length - cell.trimEnd().length
  return left === right
}

test('Cache 칸: 남은 시간과 배터리가 칸 가운데에 그려진다', async ($, on) => {
  setup(on, (7 * 60 + 50) * 1000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  const title = (await ui.find({ type: 'Text', text: /Cache/ }))?.text ?? ''
  const time = (await ui.find({ type: 'Text', text: /52m 10s/ }))?.text ?? ''
  const rows = (await ui.findAll({ type: 'Text', text: /▐/ }))
    .map(f => f.text ?? '')
    .filter(t => t.split('│').length > 3)

  expect(lastCell(title)).toBe('   Cache   ')
  expect(lastCell(time)).toBe('  52m 10s  ')
  expect(rows.length).toBe(2)
  for (const row of rows) {
    const cell = lastCell(row)
    expect(cell.length).toBe(11)
    expect(balanced(cell)).toBe(true)
  }
  await ui.unmount()
})

test('Cache 칸: 1시간이 지나면 Expired, 응답 전에는 –', async ($, on) => {
  setup(on, 61 * 60 * 1000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const time = (await ui.find({ type: 'Text', text: /Expired/ }))?.text ?? ''
  expect(lastCell(time)).toBe('  Expired  ')
  await ui.unmount()
})
