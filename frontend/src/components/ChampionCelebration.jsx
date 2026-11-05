import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ClubCrest from './ClubCrest'
import { TrophyIcon } from './Icons'

const COLORS = ['#2ee6ff', '#7ff4ff', '#3f6bff', '#2346ff', '#8a5cff', '#b79bff', '#ffffff', '#ffd60a']
const SEEN_KEY = 'champion-celebrated'

/** Estatísticas da dupla nas partidas concluídas (empate = decidido nos penáltis). */
function teamStats(matches, id) {
  const s = { played: 0, wins: 0, draws: 0, gf: 0, ga: 0 }
  for (const m of matches) {
    if (m.status !== 'completed' || (m.team1_id !== id && m.team2_id !== id)) continue
    const home = m.team1_id === id
    const gf = (home ? m.score1 : m.score2) ?? 0
    const ga = (home ? m.score2 : m.score1) ?? 0
    s.played++; s.gf += gf; s.ga += ga
    if (gf === ga) s.draws++
    else if (gf > ga) s.wins++
  }
  return s
}

function seen(key) {
  try { return sessionStorage.getItem(SEEN_KEY) === key } catch { return false }
}
function markSeen(key) {
  try { sessionStorage.setItem(SEEN_KEY, key) } catch { /* sem storage: volta a mostrar */ }
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 140 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.4,
    dur: 2.8 + Math.random() * 2.6,
    drift: (Math.random() - 0.5) * 220,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 10,
    round: Math.random() > 0.75,
    color: COLORS[i % COLORS.length],
  })), [])
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.h, background: p.color,
            borderRadius: p.round ? '50%' : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
            '--drift': `${p.drift}px`, '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Celebração em ecrã inteiro quando há campeão: confetes, escudo e números da dupla.
 * Aparece quando o campeão fica decidido (ou ao abrir a página), uma vez por sessão.
 */
export default function ChampionCelebration({ idx, championId }) {
  const [open, setOpen] = useState(false)
  const key = championId ? `${championId}` : null
  const lastKey = useRef(null)

  useEffect(() => {
    if (!key || idx.hidden || key === lastKey.current) return
    lastKey.current = key
    if (!seen(key)) setOpen(true)
  }, [key, idx.hidden])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const team = championId ? idx.teamsById[championId] : null
  if (!open || !team) return null
  const st = teamStats(idx.matches, team.id)
  function close() { markSeen(key); setOpen(false) }

  return createPortal(
    <div className="champ" role="dialog" aria-modal="true" aria-label={`${team.name} é campeão`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <Confetti />
      <div className="champ__panel">
        <button className="champ__close" onClick={close} aria-label="Fechar">×</button>
        <div className="champ__trophy"><TrophyIcon size={56} /></div>
        <p className="champ__eyebrow">Campeão</p>
        <div className="champ__crest"><ClubCrest clubId={team.club_id} size={120} /></div>
        <h2 className="champ__name">{team.name}</h2>
        {team.players && <p className="champ__players">{team.players}</p>}
        <dl className="champ__stats">
          <div><dt>Jogos</dt><dd>{st.played}</dd></div>
          <div className="is-main"><dt>Vitórias</dt><dd>{st.wins}</dd></div>
          <div className="is-main"><dt>Empates</dt><dd>{st.draws}</dd></div>
          <div><dt>Golos</dt><dd>{st.gf}<small>:{st.ga}</small></dd></div>
        </dl>
        {st.draws > 0 && <p className="champ__note">Empates decididos nos penáltis</p>}
      </div>
    </div>,
    document.body,
  )
}
