export const TrophyIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="trophyG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e9fbff" />
        <stop offset=".5" stopColor="#8fdcff" />
        <stop offset="1" stopColor="#5b6bff" />
      </linearGradient>
    </defs>
    <path d="M20 6h24v14c0 9-5 16-12 18-7-2-12-9-12-18z" fill="url(#trophyG)" />
    <path d="M20 10H9c0 9 5 15 12 16M44 10h11c0 9-5 15-12 16" fill="none" stroke="url(#trophyG)" strokeWidth="3" />
    <path d="M28 38h8v10h-8z" fill="url(#trophyG)" />
    <path d="M18 52h28l2 6H16z" fill="url(#trophyG)" />
  </svg>
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
