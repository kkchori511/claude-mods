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
    limits: [
      { kind: 'five_hour', percentUsed: 20, resetsAt: new Date(NOW + (3 * 60 + 54) * 60_000).toISOString() },
      { kind: 'seven_day', percentUsed: 51, resetsAt: new Date(NOW + (2 * 24 + 16) * 3_600_000).toISOString() },
    ],
  },
  cacheAt: cacheAgoMs === null ? null : NOW - cacheAgoMs,
  cacheTtl: '1h',
  logoGen: 7,
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
  const time = (await ui.find({ type: 'Text', text: /^\s*52m 10s\s*$/ }))?.text ?? ''

  expect(lastCell(title)).toBe('   Cache   ')
  expect(time).toBe('  52m 10s  ')
  expect(balanced(time)).toBe(true)

  // 배터리는 따로 도는 그림 칸(battery-<세대>)이다. 87% -> 위 칸 6단계(▆), 아래 칸 꽉 참(▀ 두 색).
  const battery = JSON.stringify(await ui.drawn({ in: 'battery-7' }))
  expect(battery.includes('▆▆▆')).toBe(true)
  expect(battery.includes('▀▀▀')).toBe(true)
  expect(battery.split('▐').length - 1).toBe(2)
  await ui.unmount()
})

test('Cache 칸: 1시간이 지나면 Expired, 응답 전에는 –', async ($, on) => {
  setup(on, 61 * 60 * 1000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const time = (await ui.find({ type: 'Text', text: /^\s*Expired\s*$/ }))?.text ?? ''
  expect(time).toBe('  Expired  ')
  await ui.unmount()
})

test('Context, 5-hour, Weekly 칸은 폭 12로 같고 Resets 글자가 없다', async ($, on) => {
  setup(on, (7 * 60 + 50) * 1000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const lines = (await ui.findAll({ type: 'Text' }))
    .map(f => f.text ?? '')
    .filter(t => t.split('│').length > 3)
  const title = lines.find(t => t.includes('Context')) ?? ''
  const subs = lines.find(t => t.includes('3h 54m')) ?? ''

  expect(title.split('│').slice(2, 5)).toEqual(['  Context   ', '   5-hour   ', '   Weekly   '])
  expect(subs.split('│').slice(0, 3)).toEqual(['  59k / 1M  ', '   3h 54m   ', '   2d 16h   '])
  expect(subs.includes('Resets')).toBe(false)
  await ui.unmount()
})

test('로고 칸 이름은 세대 번호를 따라 바뀐다 (내려간 로고가 다시 만들어지도록)', async ($, on) => {
  setup(on, 0)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const logo = await ui.find({ type: 'Client' })
  expect(logo?.key).toBe('logo-7')
  await ui.unmount()
})

test('로고는 칸마다 색을 따로 칠한다 (색 물결)', async ($, on) => {
  setup(on, 0)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const tree = JSON.stringify(await ui.drawn({ in: 'logo-7' }))
  const colors: string[] = tree.match(/#[0-9a-f]{6}/g) ?? []

  expect(colors.length).toBe(29)
  expect(colors.includes('#d97757')).toBe(true)
  await ui.unmount()
})
