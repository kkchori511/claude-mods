export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }
export type Snapshot = {
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number | null
  limits: Limit[]
  costUsd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { snapshot: Snapshot | null; period: number }
  }
}
