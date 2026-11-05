import { useEffect, useMemo, useRef, useState } from 'react'
import MatchCard from './MatchCard'
import ClubCrest from './ClubCrest'
import { TrophyIcon } from './Icons'
import { computeLayout, matchNumberMap } from '../lib/bracket'

const MOBILE_QUERY = '(max-width: 720px)'

/** true quando o ecrã é estreito (telemóvel); acompanha mudanças de tamanho. */
function useIsMobile() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

/** Chaveamento em duas metades, fases da esquerda/direita para a final ao centro. */
export default function Bracket({ idx, championId, onMatchClick, draft = false, fill = false }) {
  // No telemóvel: uma coluna por fase (esquerda → direita), cartões em tamanho real e scroll.
  const mobile = useIsMobile()
  const layout = useMemo(() => computeLayout(idx, { linear: mobile }), [idx, mobile])
  const numbers = useMemo(() => matchNumberMap(idx), [idx])
  const scrollRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [fitted, setFitted] = useState(false)

  // Ajusta ao ecrã na primeira apresentação (sem descer abaixo de 50%).
  useEffect(() => {
    if (mobile) { setZoom(1); setFitted(false); return }
    if (fill || !layout || fitted || !scrollRef.current) return
    const avail = scrollRef.current.clientWidth - 8
    setZoom(Math.max(0.5, Math.min(1, avail / layout.width)))
    setFitted(true)
  }, [fill, layout, fitted, mobile])

  // Página pública (fill): chaveamento fixo, sempre do tamanho exato do ecrã,
  // sem scroll nem botões de zoom; reajusta quando a janela muda de tamanho.
  useEffect(() => {
    const el = scrollRef.current
    if (!fill || mobile || !layout || !el) return
    const fit = () => setZoom(Math.min(2, (el.clientWidth - 16) / layout.width))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill, layout, mobile])

  if (!layout) return null
  const champion = championId ? idx.teamsById[championId] : null
  const finalNode = layout.nodes.find((n) => n.side === 'center')
  // Espaço superior: títulos das fases + troféu acima da final (que está ao centro).
  const TOP = Math.max(48, 156 - (finalNode ? finalNode.y : 0))
  const W = layout.width
  const H = layout.height + TOP + 24
  const fixed = fill && !mobile

  return (
    <div className="bracket">
      {!fill && !mobile && <div className="bracket__tools">
        <button className="btn btn--ghost btn--sm" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} aria-label="Reduzir">−</button>
        <span className="bracket__zoom">{Math.round(zoom * 100)}%</span>
        <button className="btn btn--ghost btn--sm" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.1).toFixed(2)))} aria-label="Ampliar">+</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setFitted(false)}>Ajustar</button>
      </div>}
      <div className={`bracket__scroll ${fixed ? 'bracket__scroll--fixed' : ''}`} ref={scrollRef}>
        <div style={{ width: W * zoom, height: H * zoom, margin: fixed ? '0 auto' : undefined }}>
          <div className="bracket__canvas" style={{ width: W, height: H, transform: `scale(${zoom})` }}>
            {layout.columns.map((c, i) => (
              <div key={i} className={`bracket__colhead ${c.round === idx.roundsCount ? 'is-final' : ''}`} style={{ left: c.x, width: layout.cardW }}>
                {c.name}
              </div>
            ))}
            <svg className="bracket__lines" width={W} height={H}>
              <defs>
                <linearGradient id="lineActive" x1="0" x2="1">
                  <stop offset="0" stopColor="#2ee6ff" />
                  <stop offset="1" stopColor="#6f7dff" />
                </linearGradient>
              </defs>
              <g transform={`translate(0 ${TOP})`}>
                {layout.links.map((l) => (
                  <path key={l.id} d={l.d} className={l.active ? 'link link--on' : 'link'} />
                ))}
              </g>
            </svg>
            {finalNode && (
              <div className={`bracket__trophy ${champion ? 'has-champion' : ''}`} style={{ left: finalNode.x, width: layout.cardW, top: TOP + finalNode.y - 132 }}>
                <TrophyIcon size={champion ? 46 : 40} />
                {champion ? (
                  <div className="bracket__champion">
                    <ClubCrest clubId={champion.club_id} size={26} />
                    <span>{champion.name}</span>
                  </div>
                ) : (
                  <div className="bracket__champion bracket__champion--tbd">Campeão por decidir</div>
                )}
              </div>
            )}
            {layout.nodes.map((n) => (
              <MatchCard
                key={n.match.id}
                match={n.match}
                teamsById={idx.teamsById}
                number={numbers[n.match.id]}
                draft={draft}
                hidden={idx.hidden}
                onClick={onMatchClick}
                style={{ position: 'absolute', left: n.x, top: TOP + n.y, width: layout.cardW, height: layout.cardH }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
