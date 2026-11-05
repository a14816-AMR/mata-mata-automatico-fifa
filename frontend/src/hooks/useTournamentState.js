import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

const POLL_MS = 15000

/**
 * Estado completo do torneio + sincronização em tempo real.
 * Qualquer alteração em tournaments/teams/matches (Supabase Realtime) volta a
 * carregar o estado. Sem Realtime disponível, recorre a polling.
 * Com ``publicView`` mostra sempre a versão pública (mesmo com sessão de admin).
 */
export function useTournamentState({ publicView = false } = {}) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [live, setLive] = useState(false)
  const timer = useRef(null)
  const inflight = useRef(false)
  const again = useRef(false)

  const refresh = useCallback(async () => {
    if (inflight.current) { again.current = true; return }
    inflight.current = true
    try {
      const s = await api.state({ publicView })
      setState(s)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      inflight.current = false
      if (again.current) { again.current = false; refresh() }
    }
  }, [publicView])

  const scheduleRefresh = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(refresh, 250)
  }, [refresh])

  useEffect(() => {
    refresh()
    let channel
    if (supabase) {
      channel = supabase.channel('torneio-ao-vivo')
      for (const table of ['tournaments', 'teams', 'matches']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
      }
      channel.subscribe((status) => {
        const ok = status === 'SUBSCRIBED'
        setLive(ok)
        if (ok) scheduleRefresh()
      })
    }
    const onVisible = () => document.visibilityState === 'visible' && scheduleRefresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) supabase.removeChannel(channel)
    }
  }, [refresh, scheduleRefresh])

  // Polling de recurso quando o Realtime não está ligado.
  useEffect(() => {
    if (live) return
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [live, refresh])

  return { state, setState, error, live, refresh }
}
