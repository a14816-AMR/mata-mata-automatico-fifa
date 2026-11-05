import ClubCrest from './ClubCrest'
import { CheckIcon } from './Icons'
import { useGoalFlash } from '../hooks/useGoalFlash'

function TeamRow({ team, score, pen, showPen, state, placeholder, hidden }) {
  const goal = useGoalFlash(score)
  return (
    <div className={`mrow mrow--${state} ${goal ? 'mrow--goal' : ''}`}>
      {team && <span className="mrow__crest-bg" aria-hidden="true"><ClubCrest clubId={team.club_id} size={80} /></span>}
      {hidden && <span className="mrow__crest-bg" aria-hidden="true"><img className="crest crest--default" src="/clubs/default.png" alt="" draggable={false} /></span>}
      <span className="mrow__info">
        <span className={`mrow__name ${team ? '' : 'mrow__name--muted'}`}>{team ? team.name : placeholder}</span>
        {team?.players && <span className="mrow__players">{team.players}</span>}
      </span>
      {state === 'win' && <span className="mrow__check"><CheckIcon /></span>}
      {goal && <span className="mrow__goal" aria-hidden="true">GOL!</span>}
      <span className={`mrow__score ${goal ? 'is-goal' : ''}`}>
        <span key={score} className="mrow__num">{score ?? ''}</span>
        {showPen && pen != null && <small className="mrow__pen">({pen})</small>}
      </span>
    </div>
  )
}

/** Cartão de confronto usado no chaveamento e nas listas por fase. */
export default function MatchCard({ match, teamsById, onClick, number, draft = false, hidden = false, final = false, style }) {
  const t1 = teamsById[match.team1_id]
  const t2 = teamsById[match.team2_id]
  const isBye = !hidden && (match.status === 'bye' || (draft && match.round === 1 && !!t1 !== !!t2))
  const done = match.status === 'completed'
  const rowState = (id) => {
    if (!match.winner_id || !id) return 'idle'
    return match.winner_id === id ? 'win' : 'lose'
  }
  const clickable = !!onClick && !isBye
  const placeholder = isBye ? 'BYE' : 'A definir'
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={`match ${final ? 'match--final' : ''} ${match.live ? 'match--live' : ''} ${done ? 'match--done' : ''} ${isBye ? 'match--bye' : ''} ${clickable ? 'match--click' : ''}`}
      onClick={clickable ? () => onClick(match) : undefined}
      style={style}
      aria-label={clickable ? `Registar resultado${t1 && t2 ? `: ${t1.name} contra ${t2.name}` : ''}` : undefined}
    >
      <TeamRow team={t1} score={match.score1} pen={match.pen1} showPen={match.had_penalties} state={rowState(match.team1_id)} placeholder={placeholder} hidden={hidden} />
      <TeamRow team={t2} score={match.score2} pen={match.pen2} showPen={match.had_penalties} state={rowState(match.team2_id)} placeholder={placeholder} hidden={hidden} />
      {match.live && <span className="match__live"><i aria-hidden="true" />Ao vivo</span>}
      {!hidden && (number || match.had_penalties || isBye) && (
        <span className="match__tag">
          {isBye ? 'Passagem direta' : match.had_penalties ? 'Decidido nos penáltis' : `Jogo ${number}`}
        </span>
      )}
    </Tag>
  )
}
