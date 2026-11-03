import { useMemo, useState } from 'react'
import BracketSection from '../../components/BracketSection'
import ResultModal from './ResultModal'
import { api } from '../../lib/api'
import { currentRound, indexState } from '../../lib/bracket'
import { useToast } from '../../components/Toast'

export default function ResultsStep({ state, setState }) {
  const toast = useToast()
  const idx = useMemo(() => indexState(state), [state])
  const [openId, setOpenId] = useState(null)
  const open = openId ? idx.matches.find((m) => m.id === openId) : null
  const cr = currentRound(idx)
  const pendingNow = idx.matches.filter((m) => m.status === 'pending' && m.team1_id && m.team2_id).length

  const onMatchClick = (m) => {
    if (!m.team1_id || !m.team2_id) { toast('Este confronto ainda aguarda os vencedores anteriores.'); return }
    setOpenId(m.id)
  }

  const reset = async () => {
    if (!window.confirm('Reiniciar o torneio? TODOS os resultados serão apagados e volta à organização dos confrontos (a colocação das duplas mantém-se).')) return
    try { setState(await api.reset(state.tournament.id)); toast('Torneio reiniciado.') } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="step">
      <div className="panel draw-info">
        <div>
          {state.tournament.status === 'finished'
            ? <>Torneio terminado. Pode ainda corrigir resultados, se necessário.</>
            : <>Fase atual: <strong>{idx.roundName(cr)}</strong> · {pendingNow} jogo(s) prontos a disputar</>}
        </div>
        <p className="hint">Toque num confronto para introduzir ou corrigir o resultado. O vencedor avança automaticamente e a página pública é atualizada de imediato.</p>
      </div>
      <BracketSection idx={idx} championId={state.champion_id} onMatchClick={onMatchClick} />
      <div className="actions-bar">
        <span className="actions-bar__status" />
        <button className="btn btn--danger" onClick={reset}>Reiniciar resultados</button>
      </div>
      {open && <ResultModal match={open} idx={idx} onClose={() => setOpenId(null)} onSaved={setState} />}
    </div>
  )
}
