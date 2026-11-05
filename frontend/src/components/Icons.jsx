/** Troféu do torneio (imagem); `size` é a altura em px. */
export const TrophyIcon = ({ size = 48 }) => (
  <img
    className="trophy-img"
    src="/brand/trophy.png"
    height={size}
    width={Math.round(size * 318 / 496)}
    alt=""
    aria-hidden="true"
    draggable={false}
  />
)

export const BallMark = ({ size = 34 }) => (
  <img
    src="/brand/logo.png"
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    className="ball-mark"
    draggable={false}
  />
)

export const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
