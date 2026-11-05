import { useState } from 'react'
import Bracket from './Bracket'
import RoundsList from './RoundsList'
import ChampionCelebration from './ChampionCelebration'

const prefersList = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

/** Alterna entre o chaveamento visual e a lista por fases. */
export default function BracketSection({ idx, championId, onMatchClick, draft, fill }) {
  const [view, setView] = useState(prefersList() ? 'list' : 'bracket')
  return (
    <div>
      <div className="seg" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={view === 'bracket'} className={view === 'bracket' ? 'is-on' : ''} onClick={() => setView('bracket')}>Chaveamento</button>
        <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>Por fases</button>
      </div>
      {view === 'bracket'
        ? <Bracket fill={fill} idx={idx} championId={championId} onMatchClick={onMatchClick} draft={draft} />
        : <RoundsList idx={idx} onMatchClick={onMatchClick} draft={draft} />}
      <ChampionCelebration idx={idx} championId={championId} />
    </div>
  )
}
