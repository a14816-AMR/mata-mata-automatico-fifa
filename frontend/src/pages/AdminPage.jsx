import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import Login from './admin/Login'
import TeamsStep from './admin/TeamsStep'
import DrawStep from './admin/DrawStep'
import ResultsStep from './admin/ResultsStep'
import TeamsManager from './admin/TeamsManager'
import { api, getToken, setToken } from '../lib/api'
import { useTournamentState } from '../hooks/useTournamentState'
import { useToast } from '../components/Toast'

const STEPS = [
  { key: 'setup', label: 'Duplas' },
  { key: 'draft', label: 'Confrontos' },
  { key: 'in_progress', label: 'Resultados' },
]

function Stepper({ status }) {
  const current = status === 'finished' ? 2 : STEPS.findIndex((s) => s.key === status)
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li key={s.key} className={i < current ? 'is-done' : i === current ? 'is-current' : ''}>
          <span className="stepper__n">{i + 1}</span>
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

/** Interruptor: mostra ou oculta o chaveamento na página pública. */
function BracketVisibility({ t, setState }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const visible = t.bracket_public !== false
  const toggle = async () => {
    if (visible && !window.confirm('Ocultar o chaveamento da página pública? Os visitantes deixam de ver os confrontos e os resultados.')) return
    setBusy(true)
    try {
      setState(await api.setBracketPublic(t.id, !visible))
      toast(visible ? 'Chaveamento oculto do público.' : 'Chaveamento publicado na página pública.')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`visibility ${visible ? 'is-on' : ''}`}>
      <div className="visibility__text">
        <strong>{visible ? 'Chaveamento visível ao público' : 'Chaveamento oculto do público'}</strong>
        <span>{visible
          ? 'Os visitantes veem os confrontos e os resultados na página pública.'
          : 'Só a administração vê os confrontos. Publique quando quiser revelá-los.'}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label="Mostrar chaveamento na página pública"
        className="switch"
        disabled={busy}
        onClick={toggle}
      ><i aria-hidden="true" /></button>
    </div>
  )
}

function CreateTournament({ onCreated, hasCurrent, onCancel }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { onCreated(await api.createTournament(name)) } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  return (
    <form className="panel login" onSubmit={submit}>
      <p className="eyebrow">Novo torneio</p>
      <h1>Criar torneio</h1>
      <label className="field">
        <span>Nome do torneio</span>
        <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Taça de Inverno 2026" />
      </label>
      {hasCurrent && <p className="hint">O novo torneio passa a ser o apresentado na página pública. O anterior fica guardado na base de dados.</p>}
      <div className="modal__actions">
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>}
        <span className="spacer" />
        <button className="btn btn--primary" disabled={busy || !name.trim()}>Criar</button>
      </div>
    </form>
  )
}

export default function AdminPage() {
  const toast = useToast()
  const [authed, setAuthed] = useState(() => (getToken() ? null : false)) // null = a verificar
  const { state, setState, error, live } = useTournamentState()
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    if (authed !== null) return
    api.check().then(() => setAuthed(true)).catch(() => setAuthed(false))
  }, [authed])

  const logout = () => { setToken(null); setAuthed(false) }

  const header = (
    <SiteHeader
      live={authed ? live : undefined}
      right={<>
        <Link className="btn btn--ghost btn--sm" to="/">Página pública</Link>
        {authed && (
          <button
            className="btn btn--ghost btn--sm"
            style={{ opacity: 0.15 }}
            onClick={() => setManaging(true)}
            title="Gerir duplas"
            aria-label="Gerir duplas"
          >⚙</button>
        )}
        {authed && <button className="btn btn--ghost btn--sm" onClick={logout}>Sair</button>}
      </>}
    />
  )

  if (authed !== true) {
    return (
      <div className="page">
        {header}
        <main className="container">
          {authed === null ? <div className="loading"><span className="spinner" /> A verificar sessão…</div> : <Login onDone={() => setAuthed(true)} />}
        </main>
      </div>
    )
  }

  const t = state?.tournament
  const rename = async () => {
    const name = window.prompt('Novo nome do torneio', t.name)
    if (!name || !name.trim() || name === t.name) return
    try { setState(await api.renameTournament(t.id, name)) } catch (e) { toast(e.message, 'error') }
  }
  const remove = async () => {
    const typed = window.prompt(`Para eliminar definitivamente o torneio, escreva o nome:\n${t.name}`)
    if (typed !== t.name) { if (typed !== null) toast('Nome diferente — nada foi eliminado.', 'error'); return }
    try { setState(await api.deleteTournament(t.id)); toast('Torneio eliminado.') } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="page">
      {header}
      <main className="container">
        {!state && !error && <div className="loading"><span className="spinner" /> A carregar…</div>}
        {error && <div className="notice notice--error">{error}</div>}
        {state && (!t || creating) && (
          <CreateTournament
            hasCurrent={!!t}
            onCancel={t ? () => setCreating(false) : null}
            onCreated={(s) => { setState(s); setCreating(false) }}
          />
        )}
        {t && !creating && (
          <>
            <section className="admin-head">
              <div>
                <p className="eyebrow">Administração</p>
                <h1 className="admin-head__title">{t.name}</h1>
                <div className="admin-head__links">
                  <button className="link-btn" onClick={rename}>Mudar nome</button>
                  <button className="link-btn" onClick={() => setCreating(true)}>Novo torneio</button>
                  <button className="link-btn link-btn--danger" onClick={remove}>Eliminar</button>
                </div>
              </div>
              <Stepper status={t.status} />
            </section>
            {t.status !== 'setup' && <BracketVisibility t={t} setState={setState} />}
            {t.status === 'setup' && <TeamsStep key={t.id} state={state} setState={setState} />}
            {t.status === 'draft' && <DrawStep key={t.id} state={state} setState={setState} />}
            {(t.status === 'in_progress' || t.status === 'finished') && <ResultsStep key={t.id} state={state} setState={setState} />}
          </>
        )}
      </main>
      {managing && t && <TeamsManager state={state} setState={setState} onClose={() => setManaging(false)} />}
    </div>
  )
}
