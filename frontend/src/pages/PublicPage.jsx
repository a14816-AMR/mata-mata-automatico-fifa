import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import BracketSection from '../components/BracketSection'
import ClubCrest from '../components/ClubCrest'
import { TrophyIcon } from '../components/Icons'
import { useTournamentState } from '../hooks/useTournamentState'
import { STATUS_LABEL, currentRound, eliminatedIds, indexState } from '../lib/bracket'

function Stat({ value, label }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function TeamsGrid({ idx, championId }) {
  const out = eliminatedIds(idx.matches)
  return (
    <div className="teams-grid">
      {idx.teams.map((t) => {
        const status = championId === t.id ? 'champ' : out.has(t.id) ? 'out' : 'in'
        return (
          <div key={t.id} className={`team-card team-card--${status}`}>
            <ClubCrest clubId={t.club_id} size={52} />
            <div className="team-card__name">{t.name}</div>
            {idx.matches.length > 0 && (
              <span className={`pill pill--${status}`}>
                {status === 'champ' ? 'Campeã' : status === 'out' ? 'Eliminada' : 'Em prova'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LatestResults({ idx }) {
  const recent = idx.matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 6)
  if (!recent.length) return null
  return (
    <div className="results-list">
      {recent.map((m) => {
        const t1 = idx.teamsById[m.team1_id]
        const t2 = idx.teamsById[m.team2_id]
        return (
          <div key={m.id} className="result">
            <span className="result__round">{idx.roundName(m.round)}</span>
            <div className="result__line">
              <span className={`result__team ${m.winner_id === m.team1_id ? 'is-win' : ''}`}>
                {t1?.name} <ClubCrest clubId={t1?.club_id} size={24} />
              </span>
              <span className="result__score">
                {m.score1}<i>–</i>{m.score2}
                {m.had_penalties && <small>pen. {m.pen1}–{m.pen2}</small>}
              </span>
              <span className={`result__team result__team--r ${m.winner_id === m.team2_id ? 'is-win' : ''}`}>
                <ClubCrest clubId={t2?.club_id} size={24} /> {t2?.name}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LiveNow({ idx }) {
  const liveMatches = idx.matches.filter((m) => m.live && m.team1_id && m.team2_id)
  if (!liveMatches.length) return null
  return (
    <section className="live-now" aria-live="polite">
      {liveMatches.map((m) => {
        const t1 = idx.teamsById[m.team1_id]
        const t2 = idx.teamsById[m.team2_id]
        return (
          <div key={m.id} className="live-now__item">
            <span className="live-now__tag"><i aria-hidden="true" />Ao vivo</span>
            <span className="live-now__round">{idx.roundName(m.round)}</span>
            <span className="live-now__line">
              {t1?.name} <ClubCrest clubId={t1?.club_id} size={22} />
              <strong>{m.score1 ?? 0} – {m.score2 ?? 0}</strong>
              {m.had_penalties && m.pen1 != null && <small>pen. {m.pen1}–{m.pen2}</small>}
              <ClubCrest clubId={t2?.club_id} size={22} /> {t2?.name}
            </span>
          </div>
        )
      })}
    </section>
  )
}

export default function PublicPage() {
  const { state, error, live } = useTournamentState()
  const idx = useMemo(() => indexState(state), [state])
  const t = state?.tournament
  const champion = state?.champion_id ? idx.teamsById[state.champion_id] : null
  const played = idx.matches.filter((m) => m.status === 'completed').length
  const totalGames = idx.matches.filter((m) => m.status !== 'bye' && !(m.round === 1 && !!m.team1_id !== !!m.team2_id)).length
  const cr = currentRound(idx)

  return (
    <div className="page">
      <SiteHeader live={state ? live : undefined} />
      <main className="container container--wide">
        {!state && !error && <div className="loading"><span className="spinner" /> A carregar o torneio…</div>}
        {error && !state && <div className="notice notice--error">Não foi possível carregar o torneio: {error}</div>}

        {state && !t && (
          <section className="hero hero--empty">
            <p className="eyebrow">Em breve</p>
            <h1>O torneio ainda não foi criado</h1>
            <p className="hero__sub">Assim que a organização registar as duplas, tudo aparece aqui automaticamente.</p>
          </section>
        )}

        {t && (
          <>
            <LiveNow idx={idx} />
            <section className="section section--bracket">
              <div className="section__head">
                <h2>{t.name}</h2>
                {t.status === 'draft' && t.bracket_public !== false && <span className="pill pill--draft">Confrontos em preparação</span>}
              </div>
              {t.bracket_public === false && t.status !== 'setup' ? (
                <div className="notice">O chaveamento já foi definido e será revelado em breve. Fique atento!</div>
              ) : idx.matches.length > 0 ? (
                <BracketSection fill idx={idx} championId={state.champion_id} draft={t.status === 'draft'} />
              ) : (
                <div className="notice">O chaveamento é publicado assim que as inscrições fecharem.</div>
              )}
            </section>

          </>
        )}
      </main>
      <footer className="site-footer">
        <span>Resultados atualizados {live ? 'em tempo real' : 'automaticamente'}.</span>
        <Link to="/admin">Administração</Link>
      </footer>
    </div>
  )
}
