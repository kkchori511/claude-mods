import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, null)
const period = atom({ plugin: 'usage-band', key: 'period' } as const, 4)

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

const WIDTH = 15
const INNER = WIDTH + 2
const TITLE = 'Usage'
const TITLE_INNER = 10

const bar = (percent: number): { filled: string; empty: string } => {
  const n = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return { filled: '█'.repeat(n), empty: '░'.repeat(WIDTH - n) }
}

// 한글 등 전각 문자는 터미널에서 2칸을 차지한다.
const cols = (text: string): number =>
  [...text].reduce((sum, ch) => sum + ((ch.codePointAt(0) ?? 0) >= 0x1100 ? 2 : 1), 0)

const centered = (text: string, width = INNER): string => {
  const left = Math.max(0, Math.floor((width - cols(text)) / 2))
  return ' '.repeat(left) + text + ' '.repeat(Math.max(0, width - cols(text) - left))
}

const rule = (left: string, mid: string, right: string, count: number): string =>
  left + [TITLE_INNER, ...Array.from({ length: count }, () => INNER)].map(n => '─'.repeat(n)).join(mid) + right

type Reading = {
  context: { percent?: number; tokens?: number; window: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
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
  costUsd: u.cost?.usd ?? null,
})

// Time until reset: 3d 4h / 2h 13m / 45m.
const remaining = (resetsAt: string | null, now: number): string => {
  if (resetsAt === null) return ''
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  if (days > 0) return `Resets ${days}d ${hours}h`
  if (hours > 0) return `Resets ${hours}h ${mins}m`
  return `Resets ${mins}m`
}

// 토큰 수 축약: 84000 -> 84k, 1000000 -> 1M.
const compact = (n: number): string =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(n)

const money = (usd: number): string =>
  usd > 0 && usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`

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

  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null) {
      return next(e)
    }

    const now = await $.clock.now()
    const speed = await read($, period)
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
            </Text>
            <Text>
              {items.map(item => (
                <Text key={item.kind}>
                  <Text bold>{` ${centered(item.sub, WIDTH)} `}</Text>
                  {edge}
                </Text>
              ))}
            </Text>
          </Box>
        </Box>
        <Text dimColor>{rule('└', '┴', '┘', count)}</Text>
        {snap.costUsd === null ? null : (
          <Text>
            <Text dimColor>Session cost </Text>
            <Text bold>{money(snap.costUsd)}</Text>
          </Text>
        )}
      </Box>
    )
  })
}
