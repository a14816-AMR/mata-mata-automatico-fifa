import { useState } from 'react'
import { api, setToken } from '../../lib/api'

export default function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      setToken(await api.login(password))
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="panel login" onSubmit={submit}>
      <p className="eyebrow">Área reservada</p>
      <h1>Administração</h1>
      <label className="field">
        <span>Palavra-passe</span>
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      {error && <div className="notice notice--error">{error}</div>}
      <button className="btn btn--primary" disabled={busy || !password}>{busy ? 'A entrar…' : 'Entrar'}</button>
    </form>
  )
}
