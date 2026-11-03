import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems((xs) => [...xs, { id, text, type }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast--${t.type}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
