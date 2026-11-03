import { Link } from 'react-router-dom'
import { BallMark } from './Icons'

export default function SiteHeader({ live, right }) {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <BallMark />
        <span className="brand__text">
          <strong>Mata-Mata</strong>
          <small>Duplas EA FC</small>
        </span>
      </Link>
      <div className="site-header__right">
        {live !== undefined && (
          <span className={`live ${live ? 'is-on' : ''}`} title={live ? 'Atualizações em tempo real ativas' : 'A atualizar periodicamente'}>
            <i /> {live ? 'Ao vivo' : 'Auto'}
          </span>
        )}
        {right}
      </div>
    </header>
  )
}
