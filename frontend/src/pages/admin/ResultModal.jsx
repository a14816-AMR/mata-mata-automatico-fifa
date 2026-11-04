import { useState } from 'react'
import Modal from '../../components/Modal'
import ClubCrest from '../../components/ClubCrest'
import { api } from '../../lib/api'
import { useToast } from '../../components/Toast'

const num = (v) => (v === '' || v == null ? null : Number(v))

function ScoreInput({ value, onChange, label }) {
  const n = value === '' || value == null ? null : Number(value)
  const set = (v) => onChange(String(Math.max(0, Math.min(99, v))))
  return (
    <div className="stepper-score" role="group" aria-label={label}>
      <button type="button" className="stepper-score__btn" onClick={() => set((n ?? 0) - 1)} disabled={!n} aria-label={`Diminuir ${label}`}>−</button>
      <output className="stepper-score__value" aria-live="polite">{n ?? '–'}</output>
      <button type="button" className="stepper-score__btn" onClick={() => set((n ?? -1) + 1)} disabled={n === 99} aria-label={`Aumentar ${label}`}>+</button>
    </div>
  )
}

export default function ResultModal({ match, idx, onClose, onSaved }) {
  const toast = useToast()
  const t1 = idx.teamsById[match.team1_id]
  const t2 = idx.teamsById[match.team2_id]
  const [s1, setS1] = useState(match.score1 ?? '')
  const [s2, setS2] = useState(match.score2 ?? '')
  const [pens, setPens] = useState(match.had_penalties ? 'sim' : 'nao')
  const [p1, setP1] = useState(match.pen1 ?? '')
  const [p2, setP2] = useState(match.pen2 ?? '')
  const [busy, setBusy] = useState(false)

  const nextRound = idx.byRound[match.round + 1]
  const next = nextRound ? nextRound[Math.floor(match.position / 2)] : null
  const downstreamPlayed = next && next.status === 'completed'

  const a = num(s1), b = num(s2), pa = num(p1), pb = num(p2)
  const hadPens = pens === 'sim'
  let error = null
  if (a == null || b == null) error = 'Indique os golos das duas duplas.'
  else if (!hadPens && a === b) error = 'Resultado empatado: indique se houve penáltis e o respetivo resultado.'
  else if (hadPens && a !== b) error = 'Só há penáltis quando o resultado está empatado.'
  else if (hadPens && (pa == null || pb == null)) error = 'Indique o resultado dos penáltis.'
  else if (hadPens && pa === pb) error = 'Os penáltis não podem terminar empatados.'

  const winner = error ? null : hadPens ? (pa > pb ? t1 : t2) : a > b ? t1 : t2

  const save = async (e) => {
    e.preventDefault()
    if (error) return
    if (downstreamPlayed && match.winner_id && winner && winner.id !== match.winner_id &&
        !window.confirm('O vencedor muda. Os resultados das fases seguintes que dependem deste jogo serão anulados. Continuar?')) return
    setBusy(true)
    try {
      const s = await api.setResult(match.id, { score1: a, score2: b, had_penalties: hadPens, pen1: hadPens ? pa : null, pen2: hadPens ? pb : null })
      onSaved(s)
      toast(`Resultado guardado. ${winner.name} avança!`, 'success')
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
            <ScoreInput value={s1} onChange={setS1} label={`Golos de ${t1.name}`} />
          </div>
          <span className="rf-sep">–</span>
          <div className="rf-team">
            <ClubCrest clubId={t2.club_id} size={54} />
            <span>{t2.name}</span>
            <ScoreInput value={s2} onChange={setS2} label={`Golos de ${t2.name}`} />
          </div>
        </div>

        <label className="field">
          <span>Houve disputa de penáltis?</span>
          <select value={pens} onChange={(e) => setPens(e.target.value)}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>

        {hadPens && (
          <div className="rf-pens">
            <span className="rf-pens__label">Penáltis</span>
            <ScoreInput value={p1} onChange={setP1} label={`Penáltis de ${t1.name}`} />
            <span className="rf-sep">–</span>
            <ScoreInput value={p2} onChange={setP2} label={`Penáltis de ${t2.name}`} />
          </div>
        )}

        {error && (a != null || b != null) ? <div className="notice notice--warn">{error}</div> : null}
        {winner && <div className="notice notice--ok">Vencedor: <strong>{winner.name}</strong></div>}

        <div className="modal__actions">
          {match.status === 'completed' && <button type="button" className="btn btn--danger" onClick={clear} disabled={busy}>Apagar resultado</button>}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" disabled={busy || !!error}>{busy ? 'A guardar…' : 'Guardar resultado'}</button>
        </div>
      </form>
    </Modal>
  )
}
