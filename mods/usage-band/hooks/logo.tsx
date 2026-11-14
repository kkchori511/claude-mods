import type { ClientModule } from 'claude-code'

const COLOR = '#D97757'
const SPARKLES = ['✦', '✧', '·', ' ']
const TICKS = 8

type State = { tick: number; period: number }

// 눈을 깜빡이고 오른쪽 위에서 반짝이는 클로드 마스코트.
// props.period: 한 프레임을 100ms 틱 몇 번 동안 보여줄지 (작을수록 빠르다).
const Logo: ClientModule<{ period: number }, State> = (props, surface) => {
  const { Box, Text } = surface.elements

  const period = typeof props?.period === 'number' ? props.period : 4
  const state = surface.state

  if (state === undefined || typeof state !== 'object' || state === null) {
    surface.setState({ tick: 0, period })

    let count = 0
    surface.every(100, () => {
      const s = surface.state
      if (typeof s !== 'object' || s === null) return
      count += 1

      if (count >= s.period) {
        count = 0
        surface.setState({ tick: (s.tick + 1) % TICKS, period: s.period })
      }
    })
  } else if (state.period !== period) {
    surface.setState({ tick: state.tick, period })
  }

  const tick = typeof state === 'object' && state !== null ? state.tick % TICKS : 0
  const isBlink = tick === 5
  const head = isBlink ? ' ▐█████▌ ' : ' ▐▛███▜▌ '
  const body = '▝▜█████▛▘'
  const legs = tick % 4 < 2 ? '  ▘▘ ▝▝   ' : '  ▝▝ ▘▘   '

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={COLOR}>{head}</Text>
        <Text bold>{SPARKLES[tick % SPARKLES.length]}</Text>
      </Text>
      <Text color={COLOR}>{body + ' '}</Text>
      <Text color={COLOR}>{legs}</Text>
    </Box>
  )
}

export default Logo
