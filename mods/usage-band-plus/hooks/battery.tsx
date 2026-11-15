import type { ClientModule } from 'claude-code'

// Cache 배터리: 2줄(반 칸 픽셀 4개) 높이에 그라데이션 띠가 위에서 아래로 흐른다.
// props.top / props.bottom: 위·아래 칸의 채움 단계(0~8). base: 배터리 색, highlight: 띠 가운데 색.
type Props = { top: number; bottom: number; base: string; highlight: string }
type State = { step: number }

const LEVELS = ' ▁▂▃▄▅▆▇█'
const STEPS = 12 // 0.1초 x 12 = 한 바퀴 1.2초
const BAND = 1.6 // 띠가 번지는 범위(반 칸 단위)
const START = -BAND
const END = 3 + BAND

const rgb = (hex: string): number[] => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a)
  const y = rgb(b)
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// 픽셀 px(0~3, 위에서 아래)의 밝기: 띠 가운데에서 멀수록 0에 가깝다(smoothstep).
const brightness = (px: number, pos: number): number => {
  const t = Math.max(0, 1 - Math.abs(px - pos) / BAND)
  return t * t * (3 - 2 * t)
}

const Battery: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements

  if (surface.state === undefined || surface.state === null || typeof surface.state !== 'object') {
    surface.setState({ step: 0 })
    surface.every(100, () => {
      const s = surface.state
      if (typeof s !== 'object' || s === null) return
      surface.setState({ step: (s.step + 1) % STEPS })
    })
  }

  const step = typeof surface.state === 'object' && surface.state !== null ? surface.state.step : 0
  const pos = START + ((END - START) * step) / (STEPS - 1)
  const base = typeof props?.base === 'string' ? props.base : '#98c379'
  const highlight = typeof props?.highlight === 'string' ? props.highlight : base
  const levels = [props?.top ?? 0, props?.bottom ?? 0]

  const row = (level: number, r: number) => {
    const top = mix(base, highlight, brightness(r * 2, pos))
    const bottom = mix(base, highlight, brightness(r * 2 + 1, pos))
    const inside =
      level <= 0 ? (
        <Text dimColor>{'░░░'}</Text>
      ) : level >= 8 ? (
        // 꽉 찬 칸: 위 반 칸은 글자색, 아래 반 칸은 배경색으로 따로 칠한다.
        <Text color={top} backgroundColor={bottom}>
          {'▀▀▀'}
        </Text>
      ) : (
        // 덜 찬 칸: 높이 모양은 그대로 두고 색만 띠를 따라 바꾼다.
        <Text color={level <= 4 ? bottom : mix(top, bottom, 0.5)}>{(LEVELS[level] ?? '█').repeat(3)}</Text>
      )

    return (
      <Text key={String(r)}>
        <Text>{'   '}</Text>
        <Text dimColor>▐</Text>
        {inside}
        <Text dimColor>▌</Text>
        <Text>{'   '}</Text>
      </Text>
    )
  }

  return <>{levels.map((level, r) => row(level, r))}</>
}

export default Battery
