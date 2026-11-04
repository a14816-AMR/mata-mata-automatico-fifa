import { useEffect, useRef, useState } from 'react'

/**
 * Devolve `true` durante ~2,4 s depois de o placar subir (um golo).
 * Não dispara na primeira apresentação nem quando o placar é corrigido para baixo.
 */
export function useGoalFlash(score, ms = 2400) {
  const prev = useRef(score)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const before = prev.current
    prev.current = score
    if (typeof score !== 'number' || typeof before !== 'number' || score <= before) return undefined
    setActive(true)
    const t = setTimeout(() => setActive(false), ms)
    return () => clearTimeout(t)
  }, [score, ms])
  return active
}
