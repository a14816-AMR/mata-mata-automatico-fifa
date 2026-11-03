// Utilitários de apresentação do chaveamento (a lógica de regras vive no backend).

export const STATUS_LABEL = {
  setup: 'Inscrições',
  draft: 'Sorteio dos confrontos',
  in_progress: 'Em curso',
  finished: 'Terminado',
}

export function indexState(state) {
  const teams = state?.teams || []
  const matches = state?.matches || []
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]))
  const roundsCount = state?.rounds?.length || 0
  const byRound = {}
  for (const m of matches) (byRound[m.round] ||= []).push(m)
  for (const r in byRound) byRound[r].sort((a, b) => a.position - b.position)
  const roundName = (r) => state?.rounds?.find((x) => x.round === r)?.name || `Ronda ${r}`
  return { teams, matches, teamsById, roundsCount, byRound, roundName }
}

/** Fase atual = primeira ronda com partidas por jogar. */
export function currentRound(idx) {
  for (let r = 1; r <= idx.roundsCount; r++) {
    const ms = idx.byRound[r] || []
    if (ms.some((m) => m.status === 'pending')) return r
  }
  return idx.roundsCount || null
}

/** Duplas eliminadas = perderam uma partida concluída. */
export function eliminatedIds(matches) {
  const out = new Set()
  for (const m of matches) {
    if (m.status !== 'completed' || !m.winner_id) continue
    const loser = m.winner_id === m.team1_id ? m.team2_id : m.team1_id
    if (loser) out.add(loser)
  }
  return out
}

export function matchNumberMap(idx) {
  const map = {}
  let n = 1
  for (let r = 1; r <= idx.roundsCount; r++) {
    for (const m of idx.byRound[r] || []) {
      if (m.status !== 'bye') map[m.id] = n++
    }
  }
  return map
}

/**
 * Geometria do chaveamento em duas metades com a final ao centro.
 * Devolve posições absolutas dos cartões e os caminhos das linhas de ligação.
 */
export function computeLayout(idx, { cardW = 200, cardH = 78, gapY = 14, gapX = 36 } = {}) {
  const R = idx.roundsCount
  if (!R) return null
  const cols = R === 1 ? 1 : (R - 1) * 2 + 1
  const finalCol = R === 1 ? 0 : R - 1
  const colX = (c) => c * (cardW + gapX)
  const nodes = []
  const yOf = {} // id -> centro vertical
  const firstRound = idx.byRound[1] || []
  const perSide = R === 1 ? 1 : firstRound.length / 2
  const height = Math.max(perSide * (cardH + gapY) - gapY, cardH)

  for (let r = 1; r <= R; r++) {
    const ms = idx.byRound[r] || []
    const half = ms.length / 2
    ms.forEach((m) => {
      let side, local, col
      if (r === R) {
        side = 'center'; local = 0; col = finalCol
      } else if (m.position < half) {
        side = 'left'; local = m.position; col = r - 1
      } else {
        side = 'right'; local = m.position - half; col = cols - r
      }
      let cy
      if (r === 1 || (r === R && R === 1)) {
        cy = local * (cardH + gapY) + cardH / 2
      } else {
        const prev = idx.byRound[r - 1]
        cy = (yOf[prev[m.position * 2].id] + yOf[prev[m.position * 2 + 1].id]) / 2
      }
      yOf[m.id] = cy
      nodes.push({ match: m, round: r, side, x: colX(col), y: cy - cardH / 2, col })
    })
  }

  const byId = Object.fromEntries(nodes.map((n) => [n.match.id, n]))
  const links = []
  for (const n of nodes) {
    if (n.round === R) continue
    const next = idx.byRound[n.round + 1][Math.floor(n.match.position / 2)]
    const t = byId[next.id]
    const fromRight = n.side === 'left'
    const x1 = fromRight ? n.x + cardW : n.x
    const x2 = fromRight ? t.x : t.x + cardW
    const y1 = n.y + cardH / 2
    const y2 = t.y + cardH / 2
    const xm = (x1 + x2) / 2
    links.push({
      id: n.match.id,
      d: `M${x1},${y1} H${xm} V${y2} H${x2}`,
      active: !!n.match.winner_id,
    })
  }
  const columns = []
  for (let c = 0; c < cols; c++) {
    const r = c <= finalCol ? c + 1 : cols - c
    columns.push({ x: colX(c), round: r, name: idx.roundName(r) })
  }
  return { nodes, links, columns, width: colX(cols - 1) + cardW, height, cardW, cardH }
}
