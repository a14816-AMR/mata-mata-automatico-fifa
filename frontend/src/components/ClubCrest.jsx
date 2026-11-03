import { useState } from 'react'
import { clubById } from '../lib/clubs'

/** Logótipo do clube. Se a imagem faltar, desenha um escudo com as cores do clube. */
export default function ClubCrest({ clubId, size = 32, className = '' }) {
  const club = clubById(clubId)
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (!club) return <span className={`crest crest--empty ${className}`} style={style} aria-hidden="true" />
  if (failed) {
    const [a, b] = club.colors
    return (
      <svg className={`crest ${className}`} style={style} viewBox="0 0 40 46" role="img" aria-label={club.name}>
        <path d="M20 1 38 7v15c0 11-8 19-18 23C10 41 2 33 2 22V7z" fill={a} stroke={b} strokeWidth="2.5" />
        <text x="20" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill={b} fontFamily="Saira Condensed, sans-serif">
          {club.short}
        </text>
      </svg>
    )
  }
  return (
    <img
      className={`crest ${className}`}
      style={style}
      src={`/clubs/${club.id}.png`}
      alt={club.name}
      title={club.name}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
