import { useEffect, useMemo, useState } from 'react'
import ClubCrest from '../../components/ClubCrest'
import ClubPicker from './ClubPicker'
import { api } from '../../lib/api'
import { CLUBS } from '../../lib/clubs'
import { useToast } from '../../components/Toast'

const MAX_TEAMS = 64
let keySeq = 0
const blank = () => ({ key: `n${keySeq++}`, name: '', club_id: null })

export default function TeamsStep({ state, setState }) {
  const toast = useToast()
  const tid = state.tournament.id
  const fromServer = () => state.teams.map((t) => ({ key: t.id, name: t.name, club_id: t.club_id }))
  const [rows, setRows] = useState(() => (state.teams.length ? fromServer() : Array.from({ length: 18 }, blank)))
  const [dirty, setDirty] = useState(!state.teams.length)
  const [picking, setPicking] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  // Atualiza a partir do servidor apenas quando não há edições locais.
  useEffect(() => {
    if (!dirty && state.teams.length) setRows(fromServer())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.teams])

  const uniqueClubs = rows.length <= CLUBS.length
  const takenBy = useMemo(() => {
    if (!uniqueClubs) return {}
    const map = {}
    rows.forEach((r, i) => { if (r.club_id && i !== picking) map[r.club_id] = r.name || `Dupla ${i + 1}` })
    return map
  }, [rows, picking, uniqueClubs])

  const problems = useMemo(() => {
    const p = {}
    const seen = {}
    rows.forEach((r, i) => {
      const n = r.name.trim().toLowerCase()
      if (!n) p[i] = 'Indique o nome'
      else if (seen[n] !== undefined) p[i] = 'Nome repetido'
      else if (!r.club_id) p[i] = 'Escolha um clube'
      seen[n] = i
    })
    return p
  }, [rows])
  const valid = rows.length >= 2 && Object.keys(problems).length === 0

  const update = (i, patch) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); setDirty(true) }
  const setCount = (n) => {
    const count = Math.max(2, Math.min(MAX_TEAMS, Number(n) || 2))
    setRows((rs) => (count > rs.length ? [...rs, ...Array.from({ length: count - rs.length }, blank)] : rs.slice(0, count)))
    setDirty(true)
  }
  const remove = (i) => { if (rows.length > 2) { setRows((rs) => rs.filter((_, j) => j !== i)); setDirty(true) } }

  const save = async ({ quiet = false } = {}) => {
    setShowErrors(true)
    if (!valid) { toast('Complete o nome e o clube de todas as duplas.', 'error'); return false }
    setBusy(true)
    try {
      const s = await api.saveTeams(tid, rows.map(({ name, club_id }) => ({ name, club_id })))
      setDirty(false)
      setState(s)
      if (!quiet) toast('Duplas guardadas.', 'success')
      return true
    } catch (e) {
      toast(e.message, 'error'); return false
    } finally { setBusy(false) }
  }

  const generate = async () => {
    if (dirty && !(await save({ quiet: true }))) return
    if (!dirty && !valid) { setShowErrors(true); return }
    setBusy(true)
    try {
      setState(await api.generateBracket(tid))
      toast('Chaveamento criado. Organize agora os confrontos.', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  let size = 2
  while (size < rows.length) size *= 2

  return (
    <div className="step">
      <div className="panel">
        <div className="toolbar">
          <label className="field field--inline">
            <span>Quantidade de duplas</span>
            <input type="number" min={2} max={MAX_TEAMS} value={rows.length} onChange={(e) => setCount(e.target.value)} />
          </label>
          <div className="hint">
            {rows.length} duplas · {rows.length * 2} jogadores · chaveamento de {size}
            {size > rows.length && ` · ${size - rows.length} BYE a escolher no passo seguinte`}
          </div>
        </div>
        {!uniqueClubs && <div className="notice">Com mais de {CLUBS.length} duplas, alguns clubes terão de ser repetidos.</div>}

        <ol className="team-rows">
          {rows.map((r, i) => (
            <li key={r.key} className={`team-row ${showErrors && problems[i] ? 'has-error' : ''}`}>
              <span className="team-row__n">{i + 1}</span>
              <button type="button" className={`crest-btn ${r.club_id ? '' : 'is-empty'}`} onClick={() => setPicking(i)} aria-label={r.club_id ? 'Mudar clube' : 'Escolher clube'}>
                {r.club_id ? <ClubCrest clubId={r.club_id} size={40} /> : <span>+</span>}
              </button>
              <input
                className="team-row__name"
                placeholder={`Nome da dupla ${i + 1}`}
                value={r.name}
                maxLength={60}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={`Nome da dupla ${i + 1}`}
              />
              {showErrors && problems[i] && <span className="team-row__err">{problems[i]}</span>}
              <button type="button" className="icon-btn" onClick={() => remove(i)} disabled={rows.length <= 2} aria-label={`Remover dupla ${i + 1}`}>×</button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--ghost" onClick={() => setCount(rows.length + 1)} disabled={rows.length >= MAX_TEAMS}>+ Adicionar dupla</button>
      </div>

      <div className="actions-bar">
        <span className="actions-bar__status">{dirty ? 'Alterações por guardar' : 'Tudo guardado'}</span>
        <button className="btn" onClick={() => save()} disabled={busy || !dirty}>Guardar duplas</button>
        <button className="btn btn--primary" onClick={generate} disabled={busy}>Gerar chaveamento →</button>
      </div>

      {picking !== null && (
        <ClubPicker
          value={rows[picking].club_id}
          takenBy={takenBy}
          onClose={() => setPicking(null)}
          onPick={(id) => { update(picking, { club_id: id }); setPicking(null) }}
        />
      )}
    </div>
  )
}
