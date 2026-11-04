/** Fundo: gradientes azul/ciano/roxo, painéis de bola e linhas de luz. */
/** Fundo: imagem do estádio (public/bg/stadium.png) com uma leve sobreposição para legibilidade. */
export default function Background() {
  return (
    <div className="bg bg--stadium" aria-hidden="true">
      <img className="bg__photo" src="/bg/stadium.png" alt="" />
      <div className="bg__veil" />
    </div>
  )
}
