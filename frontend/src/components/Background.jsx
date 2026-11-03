/** Fundo: gradientes azul/ciano/roxo, painéis de bola e linhas de luz. */
export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__glow bg__glow--a" />
      <div className="bg__glow bg__glow--b" />
      <div className="bg__glow bg__glow--c" />
      <svg className="bg__panels" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hexes" width="84" height="97" patternUnits="userSpaceOnUse" patternTransform="scale(1.2) rotate(8)">
            <path d="M42 0 84 24v49L42 97 0 73V24z" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
          <radialGradient id="fade" cx="78%" cy="20%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="fadeMask"><rect width="1200" height="800" fill="url(#fade)" /></mask>
          <linearGradient id="beam" x1="0" x2="1">
            <stop offset="0" stopColor="#2ee6ff" stopOpacity="0" />
            <stop offset=".5" stopColor="#5ff0ff" stopOpacity=".9" />
            <stop offset="1" stopColor="#8a5cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#hexes)" mask="url(#fadeMask)" />
        <g fill="none" stroke="url(#beam)" strokeWidth="1.2">
          <path d="M-50 620 C 300 480, 650 760, 1250 380" />
          <path d="M-50 660 C 320 520, 700 800, 1250 430" opacity=".5" />
          <path d="M-50 140 C 380 300, 760 40, 1250 220" opacity=".35" />
        </g>
        <circle cx="940" cy="170" r="190" fill="none" stroke="#2ee6ff" strokeOpacity=".12" />
        <circle cx="940" cy="170" r="260" fill="none" stroke="#8a5cff" strokeOpacity=".08" />
      </svg>
      <div className="bg__grain" />
    </div>
  )
}
