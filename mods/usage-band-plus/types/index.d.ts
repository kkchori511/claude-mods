export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }
export type Snapshot = {
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number | null
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band-plus': {
      snapshot: Snapshot | null
      period: number
      model: string | null
      effort: string | null
      cacheAt: number | null
      cacheTtl: '5m' | '1h'
      tick: number
    }
  }
}
