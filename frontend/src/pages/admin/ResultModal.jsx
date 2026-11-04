import { useState } from 'react'
import Modal from '../../components/Modal'
import ClubCrest from '../../components/ClubCrest'
import { api } from '../../lib/api'
import { useToast } from '../../components/Toast'

function ScoreInput({ value, onChange, label }) {
  const set = (v) => onChange(Math.max(0, Math.min(99, v)))
  return (
    <div className="stepper-score" role="group" aria-label={label}>
      <button type="button" className="stepper-score__btn" onClick={() => set(value - 1)} disabled={value <= 0} aria-label={`Diminuir ${label}`}>−</button>
      <output className="stepper-score__value" aria-live="polite">{value}</output>
      <button type="button" className="stepper-score__btn" onClick={() => set(value + 1)} disabled={value >= 99} aria-label={`Aumentar ${label}`}>+</button>
    </div>
  )
}

export default function ResultModal({ match, idx, onClose, onSaved }) {
  const toast = useToast()
  const t1 = idx.teamsById[match.team1_id]
  const t2 = idx.teamsById[match.team2_id]
  const [s1, setS1] = useState(match.score1 ?? 0)
  const [s2, setS2] = useState(match.score2 ?? 0)
  const [live, setLive] = useState(!!match.live)
  const [pens, setPens] = useState(match.had_penalties ? 'sim' : 'nao')
  const [p1, setP1] = useState(match.pen1 ?? 0)
  const [p2, setP2] = useState(match.pen2 ?? 0)
  const [busy, setBusy] = useState(false)

  const nextRound = idx.byRound[match.round + 1]
  const next = nextRound ? nextRound[Math.floor(match.position / 2)] : null
  const downstreamPlayed = next && next.status === 'completed'

  const hadPens = !live && pens === 'sim'
  let error = null
  if (!live) {
    if (!hadPens && s1 === s2) error = 'Resultado empatado: indique se houve penáltis e o respetivo resultado.'
    else if (hadPens && s1 !== s2) error = 'Só há penáltis quando o resultado está empatado.'
    else if (hadPens && p1 === p2) error = 'Os penáltis não podem terminar empatados.'
  }
  const winner = live || error ? null : hadPens ? (p1 > p2 ? t1 : t2) : s1 > s2 ? t1 : t2

  const save = async (e) => {
    e.preventDefault()
    if (error) { toast(error, 'error'); return }
    if (!live && downstreamPlayed && match.winner_id && winner.id !== match.winner_id &&
        !window.confirm('O vencedor muda. Os resultados das fases seguintes que dependem deste jogo serão anulados. Continuar?')) return
    if (live && match.status === 'completed' &&
        !window.confirm('Este jogo já tem resultado final. Marcá-lo como a decorrer apaga esse resultado (e os das fases seguintes que dependem dele). Continuar?')) return
    setBusy(true)
    try {
      if (live) {
        onSaved(await api.setLive(match.id, { score1: s1, score2: s2 }))
        toast('Jogo a decorrer: placar atualizado.', 'success')
      } else {
        onSaved(await api.setResult(match.id, { score1: s1, score2: s2, had_penalties: hadPens, pen1: hadPens ? p1 : null, pen2: hadPens ? p2 : null }))
        toast(`Resultado guardado. ${winner.name} avança!`, 'success')
      }
      onClose()
    } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const clear = async () => {
    if (!window.confirm(downstreamPlayed ? 'Apagar o resultado? Os resultados seguintes que dependem deste jogo também serão anulados.' : 'Apagar o resultado deste jogo?')) return
    setBusy(true)
    try { onSaved(await api.clearResult(match.id)); toast('Resultado apagado.'); onClose() }
    catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <Modal title={`${idx.roundName(match.round)} · resultado`} onClose={onClose}>
      <form className="result-form" onSubmit={save}>
        <div className="result-form__teams">
          <div className="rf-team">
            <ClubCrest clubId={t1.club_id} size={54} />
            <span>{t1.name}</span>
            <ScoreInput value={s1} onChange={setS1} label={`golos de ${t1.name}`} />
          </div>
          <label className={`rf-live ${live ? 'is-on' : ''}`}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            <span className="rf-live__dot" aria-hidden="true" />
            <span>A decorrer</span>
          </label>
          <div className="rf-team">
            <ClubCrest clubId={t2.club_id} size={54} />
            <span>{t2.name}</span>
            <ScoreInput value={s2} onChange={setS2} label={`golos de ${t2.name}`} />
          </div>
        </div>

        {!live && (
          <label className="field">
            <span>Houve disputa de penáltis?</span>
            <select value={pens} onChange={(e) => setPens(e.target.value)}>
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>
        )}

        {hadPens && (
          <div className="rf-pens">
            <span className="rf-pens__label">Penáltis</span>
            <ScoreInput value={p1} onChange={setP1} label={`penáltis de ${t1.name}`} />
            <span className="rf-sep">–</span>
            <ScoreInput value={p2} onChange={setP2} label={`penáltis de ${t2.name}`} />
          </div>
        )}

        <div className="modal__actions">
          {(match.status === 'completed' || match.live) && <button type="button" className="btn btn--danger" onClick={clear} disabled={busy}>Apagar resultado</button>}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'A guardar…' : live ? 'Atualizar placar' : 'Guardar resultado'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
