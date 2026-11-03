import { useEffect } from 'react'

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal__panel ${wide ? 'modal__panel--wide' : ''}`}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        {children}
      </div>
    </div>
  )
}
