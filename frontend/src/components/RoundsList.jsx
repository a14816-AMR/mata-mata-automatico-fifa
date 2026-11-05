import { useMemo } from 'react'
import MatchCard from './MatchCard'
import ClubCrest from './ClubCrest'
import { matchNumberMap } from '../lib/bracket'

/** Vista por fases (ideal em telemóveis). */
export default function RoundsList({ idx, onMatchClick, draft = false }) {
  const numbers = useMemo(() => matchNumberMap(idx), [idx])
  const rounds = []
  for (let r = 1; r <= idx.roundsCount; r++) rounds.push(r)
  return (
    <div className="rounds">
      {rounds.map((r) => {
        const ms = idx.byRound[r] || []
        const byes = ms.filter((m) => m.status === 'bye' || (draft && r === 1 && !!m.team1_id !== !!m.team2_id))
        const games = ms.filter((m) => !byes.includes(m))
        const done = games.filter((m) => m.status === 'completed').length
        return (
          <section key={r} className="round">
            <header className="round__head">
              <h3>{idx.roundName(r)}</h3>
              <span className="round__count">{done}/{games.length} jogos</span>
            </header>
            {games.length > 0 && (
              <div className="round__grid">
                {games.map((m) => (
                  <MatchCard key={m.id} match={m} teamsById={idx.teamsById} number={numbers[m.id]} onClick={onMatchClick} draft={draft} hidden={idx.hidden} />
                ))}
              </div>
            )}
            {byes.length > 0 && (
              <div className="round__byes">
                <span className="round__byes-label">Passagem direta (BYE)</span>
                {byes.map((m) => {
                  const t = idx.teamsById[m.team1_id || m.team2_id]
                  return t ? (
                    <span key={m.id} className="chip chip--static">
                      <ClubCrest clubId={t.club_id} size={20} /> {t.name}
                    </span>
                  ) : null
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
