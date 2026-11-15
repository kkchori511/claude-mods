import type { ClientModule } from 'claude-code'

const BASE = [0xd9, 0x77, 0x57] as const
const HIGHLIGHT = [0xff, 0xd8, 0xc2] as const
const SPARKLES = ['✦', '✧', '·', ' ']
const TICKS = 8

// 색 물결: 밝은 띠가 0.1초에 한 칸씩 왼쪽에서 오른쪽으로 지나간다(1.6초 주기).
const SHINE_STEPS = 16
const SHINE_START = -3
const SHINE_BAND = 3

type State = { tick: number; period: number; shine: number }

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, '0')

// 칸 x의 색: 띠 가운데에서 멀수록 바탕 주황에 가깝다(부드럽게 이어지도록 smoothstep).
const colorAt = (x: number, shine: number): string => {
  const pos = SHINE_START + shine
  const linear = Math.max(0, 1 - Math.abs(x - pos) / SHINE_BAND)
  const t = linear * linear * (3 - 2 * linear)
  return `#${BASE.map((b, i) => hex(b + ((HIGHLIGHT[i] ?? b) - b) * t)).join('')}`
}

// 눈을 깜빡이고 오른쪽 위에서 반짝이는 클로드 마스코트.
// props.period: 한 프레임을 100ms 틱 몇 번 동안 보여줄지 (작을수록 빠르다).
const Logo: ClientModule<{ period: number }, State> = (props, surface) => {
  const { Box, Text } = surface.elements

  const period = typeof props?.period === 'number' ? props.period : 4
  const state = surface.state

  if (state === undefined || typeof state !== 'object' || state === null) {
    surface.setState({ tick: 0, period, shine: 0 })

    let count = 0
    surface.every(100, () => {
      const s = surface.state
      if (typeof s !== 'object' || s === null) return
      count += 1

      let tick = s.tick
      if (count >= s.period) {
        count = 0
        tick = (s.tick + 1) % TICKS
      }
      surface.setState({ tick, period: s.period, shine: ((s.shine ?? 0) + 1) % SHINE_STEPS })
    })
  } else if (state.period !== period) {
    surface.setState({ tick: state.tick, period, shine: state.shine ?? 0 })
  }

  const live = typeof state === 'object' && state !== null
  const tick = live ? state.tick % TICKS : 0
  const shine = live ? (state.shine ?? 0) % SHINE_STEPS : 0
  const isBlink = tick === 5
  const head = isBlink ? ' ▐█████▌ ' : ' ▐▛███▜▌ '
  const body = '▝▜█████▛▘ '
  const legs = tick % 4 < 2 ? '  ▘▘ ▝▝   ' : '  ▝▝ ▘▘   '

  const painted = (row: string) =>
    [...row].map((ch, x) => (
      <Text key={String(x)} color={colorAt(x, shine)}>
        {ch}
      </Text>
    ))

  return (
    <Box flexDirection="column">
      <Text>
        {painted(head)}
        <Text bold>{SPARKLES[tick % SPARKLES.length]}</Text>
      </Text>
      <Text>{painted(body)}</Text>
      <Text>{painted(legs)}</Text>
    </Box>
  )
}

export default Logo
