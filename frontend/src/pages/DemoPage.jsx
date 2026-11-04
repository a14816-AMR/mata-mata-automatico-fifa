import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import MatchCard from '../components/MatchCard'
import { CLUBS } from '../lib/clubs'

const teamsById = {
  a: { id: 'a', name: 'Dupla Alfa', players: 'João, Pedro', club_id: CLUBS[0].id },
  b: { id: 'b', name: 'Dupla Beta', players: 'Ana, Rita', club_id: CLUBS[1].id },
}

/** Página de teste da animação de golo (não usa a base de dados). */
export default function DemoPage() {
  const [s, setS] = useState([0, 0])
  const bump = (i, d) => setS((v) => v.map((x, j) => (j === i ? Math.max(0, x + d) : x)))
  const match = { id: 'demo', team1_id: 'a', team2_id: 'b', score1: s[0], score2: s[1], status: 'pending', live: true, round: 1, position: 0 }
  return (
    <div className="page">
      <SiteHeader right={<Link className="btn btn--ghost btn--sm" to="/">Página pública</Link>} />
      <main className="container">
        <section className="panel" style={{ maxWidth: 420, margin: '48px auto' }}>
          <p className="eyebrow">Teste da animação de golo</p>
          <div style={{ margin: '28px 0' }}>
            <MatchCard match={match} teamsById={teamsById} />
          </div>
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={() => bump(0, 1)}>⚽ Gol Alfa</button>
            <button className="btn btn--primary" onClick={() => bump(1, 1)}>⚽ Gol Beta</button>
            <span className="spacer" />
            <button className="btn btn--ghost" onClick={() => setS([0, 0])}>Zerar</button>
          </div>
        </section>
      </main>
    </div>
  )
}
