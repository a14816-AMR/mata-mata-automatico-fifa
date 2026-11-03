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
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id="ballG" cx="38%" cy="32%">
        <stop offset="0" stopColor="#7ff4ff" />
        <stop offset=".55" stopColor="#2a4dff" />
        <stop offset="1" stopColor="#0b1360" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#ballG)" stroke="#9feeff" strokeOpacity=".6" />
    <path d="M32 19l11 8-4.2 13H25.2L21 27z" fill="#030a2b" fillOpacity=".75" />
    <path d="M32 3v16M43 27l14-5M38.8 40l8.6 12M25.2 40l-8.6 12M21 27L7 22" stroke="#030a2b" strokeOpacity=".6" strokeWidth="2.2" />
  </svg>
)

export const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
