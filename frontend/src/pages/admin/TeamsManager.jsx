import { useState } from 'react'
import Modal from '../../components/Modal'
import ClubCrest from '../../components/ClubCrest'
import ClubPicker from './ClubPicker'
import { api } from '../../lib/api'
import { CLUBS } from '../../lib/clubs'
import { useToast } from '../../components/Toast'

/** Popup de CRUD das duplas. Editar: sempre. Adicionar/remover: só na fase de inscrição. */
export default function TeamsManager({ state, setState, onClose }) {
  const toast = useToast()
  const tid = state.tournament.id
  const canStructure = state.tournament.status === 'setup'
  const teams = state.teams
  const [editing, setEditing] = useState(null) // { id|null, name, club_id }
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  const takenBy = {}
  if (teams.length <= CLUBS.length) {
    teams.forEach((t) => { if (t.id !== editing?.id) takenBy[t.club_id] = t.name })
  }

  const run = async (fn, ok) => {
    setBusy(true)
    try { setState(await fn()); if (ok) toast(ok, 'success'); return true } catch (e) { toast(e.message, 'error'); return false } finally { setBusy(false) }
  }

  const save = async () => {
    const name = editing.name.trim()
    if (!name || !editing.club_id) { toast('Indique o nome e escolha o clube.', 'error'); return }
    const payload = { name, club_id: editing.club_id }
    const done = editing.id
      ? await run(() => api.updateTeam(tid, editing.id, payload), 'Dupla atualizada.')
      : await run(() => api.saveTeams(tid, [...teams.map(({ name, club_id }) => ({ name, club_id })), payload]), 'Dupla adicionada.')
    if (done) setEditing(null)
  }

  const remove = (t) => {
    if (teams.length <= 2) { toast('São necessárias pelo menos 2 duplas.', 'error'); return }
    if (!window.confirm(`Remover a dupla «${t.name}»?`)) return
    run(() => api.saveTeams(tid, teams.filter((x) => x.id !== t.id).map(({ name, club_id }) => ({ name, club_id }))), 'Dupla removida.')
  }

  return (
    <Modal title="Gerir duplas" onClose={onClose} wide>
      {!canStructure && <div className="notice">Com o chaveamento criado só é possível editar nome e clube. Para adicionar ou remover duplas volte ao passo «Duplas».</div>}
      <ol className="team-rows" style={{ gridTemplateColumns: '1fr' }}>
        {teams.map((t, i) => (
          <li key={t.id} className="team-row" style={{ gridTemplateColumns: '26px 52px 1fr auto auto' }}>
            <span className="team-row__n">{i + 1}</span>
            <ClubCrest clubId={t.club_id} size={40} />
            <span>{t.name}</span>
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setEditing({ id: t.id, name: t.name, club_id: t.club_id })}>Editar</button>
            {canStructure
              ? <button type="button" className="icon-btn" disabled={busy || teams.length <= 2} onClick={() => remove(t)} aria-label={`Remover ${t.name}`}>×</button>
              : <span />}
          </li>
        ))}
      </ol>
      {canStructure && (
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setEditing({ id: null, name: '', club_id: null })}>+ Adicionar dupla</button>
      )}

      {editing && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="team-row" style={{ gridTemplateColumns: '52px 1fr' }}>
            <button type="button" className={`crest-btn ${editing.club_id ? '' : 'is-empty'}`} onClick={() => setPicking(true)} aria-label="Escolher clube">
              {editing.club_id ? <ClubCrest clubId={editing.club_id} size={40} /> : <span>+</span>}
            </button>
            <input className="team-row__name" autoFocus maxLength={60} placeholder="Nome da dupla" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Cancelar</button>
            <span className="spacer" />
            <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>{editing.id ? 'Guardar' : 'Adicionar'}</button>
          </div>
        </div>
      )}
      {picking && (
        <ClubPicker value={editing.club_id} takenBy={takenBy} onClose={() => setPicking(false)} onPick={(id) => { setEditing({ ...editing, club_id: id }); setPicking(false) }} />
      )}
    </Modal>
  )
}
