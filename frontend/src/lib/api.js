const TOKEN_KEY = 'eafc_admin_token'

export function getToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const { token, expires_at } = JSON.parse(raw)
    if (expires_at * 1000 < Date.now()) return null
    return token
  } catch {
    return null
  }
}

export function setToken(data) {
  try {
    if (data) localStorage.setItem(TOKEN_KEY, JSON.stringify(data))
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* armazenamento indisponível */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Sem ligação ao servidor. Verifique a internet.', 0)
  }
  let data = null
  try { data = await res.json() } catch { /* sem corpo */ }
  if (!res.ok) {
    let msg = data?.detail
    if (Array.isArray(msg)) msg = msg.map((d) => d.msg).join(' · ')
    if (res.status === 401 && path !== '/auth/login') setToken(null)
    throw new ApiError(msg || `Erro ${res.status}`, res.status)
  }
  return data
}

export const api = {
  state: () => request('GET', '/state'),
  health: () => request('GET', '/health'),
  login: (password) => request('POST', '/auth/login', { password }),
  check: () => request('GET', '/auth/check'),
  createTournament: (name) => request('POST', '/tournaments', { name }),
  renameTournament: (id, name) => request('PATCH', `/tournaments/${id}`, { name }),
  deleteTournament: (id) => request('DELETE', `/tournaments/${id}`),
  saveTeams: (id, teams) => request('PUT', `/tournaments/${id}/teams`, { teams }),
  updateTeam: (id, teamId, team) => request('PATCH', `/tournaments/${id}/teams/${teamId}`, team),
  generateBracket: (id) => request('POST', `/tournaments/${id}/bracket`),
  backToSetup: (id) => request('DELETE', `/tournaments/${id}/bracket`),
  saveLayout: (id, slots) => request('PUT', `/tournaments/${id}/layout`, { slots }),
  start: (id) => request('POST', `/tournaments/${id}/start`),
  reset: (id) => request('POST', `/tournaments/${id}/reset`),
  setResult: (matchId, result) => request('PUT', `/matches/${matchId}/result`, result),
  setLive: (matchId, score) => request('PUT', `/matches/${matchId}/live`, score),
  clearResult: (matchId) => request('DELETE', `/matches/${matchId}/result`),
}
