import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-band-plus', key: 'snapshot' } as const, null)
const period = atom({ plugin: 'usage-band-plus', key: 'period' } as const, 4)
const model = atom({ plugin: 'usage-band-plus', key: 'model' } as const, null)
const effort = atom({ plugin: 'usage-band-plus', key: 'effort' } as const, null)
// 프롬프트 캐시: 마지막 메인 응답 시각(ms)과 유지 시간, 1초마다 다시 그리기 위한 틱.
const cacheAt = atom({ plugin: 'usage-band-plus', key: 'cacheAt' } as const, null)
const cacheTtl = atom({ plugin: 'usage-band-plus', key: 'cacheTtl' } as const, '1h')
const tick = atom({ plugin: 'usage-band-plus', key: 'tick' } as const, 0)

const ORANGE = '#D97757'

// 이번 응답의 토큰 소모량에 따른 프레임 간격(100ms 틱 수): 많을수록 빠르다.
const periodFor = (tokens: number): number =>
  tokens >= 8000 ? 1 : tokens >= 3000 ? 2 : tokens >= 1000 ? 3 : 4

const LABELS: Record<string, string> = {
  five_hour: '5-hour',
  seven_day: 'Weekly',
  spend_limit: 'Spend limit',
}

const COLORS: Record<string, string> = {
  context: 'cyan',
  five_hour: 'blue',
  seven_day: 'magenta',
}

// 파랑 -> 빨강 순서의 색 눈금. model과 effort가 같은 눈금을 쓴다.
const BLUE = '#4C9AFF'
const CYAN = '#2BC4D8'
const YELLOW = '#E5C07B'
const AMBER = '#F08C3A'
const RED = '#F25C54'

// haiku는 파랑, sonnet은 주황, opus는 빨강. 그 밖의 model은 기본 색.
const modelColor = (name: string | null): string | undefined => {
  const id = (name ?? '').toLowerCase()

  return id.includes('haiku') ? BLUE : id.includes('sonnet') ? AMBER : id.includes('opus') ? RED : undefined
}

const EFFORT_COLORS: Record<string, string> = {
  low: BLUE,
  medium: CYAN,
  high: YELLOW,
  xhigh: AMBER,
  max: RED,
}

const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

// 5단계 중 몇 단계인지: high -> ' (3/5)'. 단계 밖의 값(숫자 등)에는 붙이지 않는다.
const effortStep = (level: string | null): string => {
  const index = level === null ? -1 : EFFORT_LEVELS.indexOf(level)

  return index < 0 ? '' : ` (${index + 1}/${EFFORT_LEVELS.length})`
}

const WIDTH = 10
const INNER = WIDTH + 2
const TITLE = 'Usage'
const TITLE_INNER = 10

// Cache 칸: 안쪽 폭 11. 배터리(5칸)와 시간(7칸)이 모두 홀수라 양쪽 여백이 똑같다.
const CACHE_INNER = 11
const GREEN = '#98C379'
const LEVELS = ' ▁▂▃▄▅▆▇█'
const TTL_MS: Record<string, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }

// 남은 비율 -> 배터리 위/아래 칸의 채움 단계(각 0~8, 합쳐 16단계).
const battery = (fraction: number): { top: number; bottom: number } => {
  const n = Math.max(0, Math.min(16, Math.round(fraction * 16)))
  return { top: Math.max(0, n - 8), bottom: Math.min(8, n) }
}

const batteryColor = (fraction: number): string =>
  fraction > 0.5 ? GREEN : fraction > 0.2 ? YELLOW : RED

// 남은 시간: 항상 7칸(05m 09s). 만료면 Expired.
const countdown = (ms: number): string => {
  if (ms <= 0) return 'Expired'
  const secs = Math.ceil(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(secs / 60))}m ${pad(secs % 60)}s`
}

const bar = (percent: number): { filled: string; empty: string } => {
  const n = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return { filled: '█'.repeat(n), empty: '░'.repeat(WIDTH - n) }
}

// 한글 등 전각 문자는 터미널에서 2칸을 차지한다.
// 블록·점자 같은 기호는 1칸이라 한글·한자·전각·이모지 범위만 2칸으로 센다.
const isWide = (c: number): boolean =>
  (c >= 0x1100 && c <= 0x115f) ||
  (c >= 0x2e80 && c <= 0xa4cf) ||
  (c >= 0xac00 && c <= 0xd7a3) ||
  (c >= 0xf900 && c <= 0xfaff) ||
  (c >= 0xfe30 && c <= 0xfe4f) ||
  (c >= 0xff00 && c <= 0xff60) ||
  (c >= 0xffe0 && c <= 0xffe6) ||
  (c >= 0x1f300 && c <= 0x1faff)

const cols = (text: string): number =>
  [...text].reduce((sum, ch) => sum + (isWide(ch.codePointAt(0) ?? 0) ? 2 : 1), 0)

const centered = (text: string, width = INNER): string => {
  const left = Math.max(0, Math.floor((width - cols(text)) / 2))
  return ' '.repeat(left) + text + ' '.repeat(Math.max(0, width - cols(text) - left))
}

const rule = (left: string, mid: string, right: string, count: number): string =>
  left +
  [TITLE_INNER, ...Array.from({ length: count }, () => INNER), CACHE_INNER].map(n => '─'.repeat(n)).join(mid) +
  right

type Reading = {
  context: { percent?: number; tokens?: number; window: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
}

const toSnapshot = (u: Reading): Snapshot => ({
  contextPercent: u.context.percent ?? null,
  contextTokens: u.context.tokens ?? null,
  contextWindow: u.context.window,
  limits: u.rateLimits.map(r => ({
    kind: r.kind,
    percentUsed: r.percentUsed,
    resetsAt: r.resetsAt ?? null,
  })),
})

// Time until reset: 3d 4h / 2h 13m / 45m (no "Resets" prefix).
const remaining = (resetsAt: string | null, now: number): string => {
  if (resetsAt === null) return ''
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// 토큰 수 축약: 84000 -> 84k, 1000000 -> 1M.
const compact = (n: number): string =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(n)

export const register: Register = on => {
  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.usage !== undefined) {
      const tokens =
        e.usage.input_tokens + e.usage.output_tokens + e.usage.cache_creation_input_tokens
      await update($, period, () => periodFor(tokens))
    }

    return next(e)
  })

  // 모델을 바꿀 때만 엔진이 캐시 유지 시간(5m/1h)을 알려 준다.
  on('classic.PostModelSwitch', async ($, e, next) => {
    await update($, cacheTtl, () => e.cache_ttl)

    return next(e)
  })

  on('session.start', async ($, e, next) => {
    // 1초마다 다시 그려 남은 시간이 실시간으로 줄어들게 한다.
    $.clock.every(1000, () => {
      void update($, tick, n => (n + 1) % 1_000_000)
    })
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const current = await $.session.model()
    await update($, model, () => current)

    return next(e)
  })

  // 메인 루프의 요청마다 쓰인 model과 effort를 기록한다 (서브에이전트는 제외).
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      await update($, model, () => e.model)
      await update($, effort, () => (e.effort === undefined ? null : String(e.effort)))
    }

    const result = yield* next(e)

    // 메인 루프의 응답이 오면 캐시가 새로 데워진 것으로 보고 카운트를 다시 시작한다.
    if (e.agentId === undefined && result.usage !== null) {
      const at = await $.clock.now()
      await update($, cacheAt, () => at)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null) {
      return next(e)
    }

    const now = await $.clock.now()
    const currentModel = await read($, model)
    const currentEffort = await read($, effort)
    const speed = await read($, period)
    await read($, tick)
    const lastAt = await read($, cacheAt)
    const ttl = TTL_MS[await read($, cacheTtl)] ?? 60 * 60_000
    const left = lastAt === null ? 0 : Math.max(0, lastAt + ttl - now)
    const fraction = left / ttl
    const cell = battery(fraction)
    const fill = batteryColor(fraction)
    const timeText = lastAt === null ? '–' : countdown(left)
    const level = (n: number) =>
      n > 0 ? <Text color={fill}>{(LEVELS[n] ?? '█').repeat(3)}</Text> : <Text dimColor>{'░░░'}</Text>
    const batteryRow = (n: number) => (
      <Text>
        <Text>{'   '}</Text>
        <Text dimColor>▐</Text>
        {level(n)}
        <Text dimColor>▌</Text>
        <Text>{'   '}</Text>
      </Text>
    )
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const Client = 'Client' in ui ? ui.Client : null
    const items = [
      { kind: 'context', label: 'Context', percent: snap.contextPercent, sub: snap.contextTokens === null || snap.contextWindow === null ? '' : `${compact(snap.contextTokens)} / ${compact(snap.contextWindow)}` },
      ...snap.limits.map(l => ({
        kind: l.kind,
        label: LABELS[l.kind] ?? l.kind,
        percent: l.percentUsed as number | null,
        sub: remaining(l.resetsAt, now),
      })),
    ]

    const count = items.length
    const edge = <Text dimColor>│</Text>

    // 표 전체 폭(제목 칸 + 칸마다 안쪽 폭과 경계선 + 양끝)에 맞춰 model/effort 줄을 가운데로 놓는다.
    const tableWidth = TITLE_INNER + count * (INNER + 1) + (CACHE_INNER + 1) + 2
    const modelText = currentModel ?? '–'
    const effortText = `${currentEffort ?? '–'}${effortStep(currentEffort)}`
    const pad = ' '.repeat(
      Math.max(0, Math.floor((tableWidth - cols(`Model : ${modelText} / Effort : ${effortText}`)) / 2)),
    )

    return (
      <Box flexDirection="column">
        <Text dimColor>{rule('┌', '┬', '┐', count)}</Text>
        <Text>
          {edge}
          <Text bold color={ORANGE}>{centered(TITLE, TITLE_INNER)}</Text>
          {edge}
          {items.map(item => (
            <Text key={item.kind}>
              <Text bold color={COLORS[item.kind] ?? 'green'}>
                {centered(item.label)}
              </Text>
              {edge}
            </Text>
          ))}
          <Text bold color={GREEN}>{centered('Cache', CACHE_INNER)}</Text>
          {edge}
        </Text>
        <Text dimColor>{rule('├', '┼', '┤', count)}</Text>
        <Box flexDirection="row">
          <Text dimColor>{'│\n│\n│'}</Text>
          {Client === null ? (
            <Box width={TITLE_INNER} height={3} />
          ) : (
            <Client key="logo-v2" module="./logo.tsx" props={{ period: speed }} width={TITLE_INNER} height={3} />
          )}
          <Text dimColor>{'│\n│\n│'}</Text>
          <Box flexDirection="column">
            <Text>
              {items.map(item => (
                <Text key={item.kind}>
                  <Text bold>
                    {centered(item.percent === null ? '–' : `${Math.round(item.percent)}%`)}
                  </Text>
                  {edge}
                </Text>
              ))}
              {batteryRow(cell.top)}
              {edge}
            </Text>
            <Text>
              {items.map(item => {
                const b = item.percent === null ? null : bar(item.percent)

                return (
                  <Text key={item.kind}>
                    <Text> </Text>
                    {b === null ? (
                      <Text dimColor>{'░'.repeat(WIDTH)}</Text>
                    ) : (
                      <Text>
                        <Text color={COLORS[item.kind] ?? 'green'}>{b.filled}</Text>
                        <Text dimColor>{b.empty}</Text>
                      </Text>
                    )}
                    <Text> </Text>
                    {edge}
                  </Text>
                )
              })}
              {batteryRow(cell.bottom)}
              {edge}
            </Text>
            <Text>
              {items.map(item => (
                <Text key={item.kind}>
                  <Text bold>{` ${centered(item.sub, WIDTH)} `}</Text>
                  {edge}
                </Text>
              ))}
              <Text bold dimColor={lastAt !== null && left <= 0}>{centered(timeText, CACHE_INNER)}</Text>
              {edge}
            </Text>
          </Box>
        </Box>
        <Text dimColor>{rule('└', '┴', '┘', count)}</Text>
        <Text>
          <Text>{pad}</Text>
          <Text bold>Model : </Text>
          <Text bold color={modelColor(currentModel)}>{modelText}</Text>
          <Text bold> / </Text>
          <Text bold>Effort : </Text>
          <Text bold color={currentEffort === null ? undefined : EFFORT_COLORS[currentEffort]}>{effortText}</Text>
        </Text>
      </Box>
    )
  })
}
