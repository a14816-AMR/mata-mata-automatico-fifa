import Modal from '../../components/Modal'
import ClubCrest from '../../components/ClubCrest'
import { CLUBS } from '../../lib/clubs'

/** Seleção visual: apenas os logótipos dos 30 clubes. */
export default function ClubPicker({ value, takenBy, onPick, onClose }) {
  return (
    <Modal title="Escolher clube" onClose={onClose} wide>
      <div className="club-grid">
        {CLUBS.map((c) => {
          const owner = takenBy[c.id]
          const selected = value === c.id
          return (
            <button
              key={c.id}
              type="button"
              className={`club-opt ${selected ? 'is-selected' : ''} ${owner ? 'is-taken' : ''}`}
              disabled={!!owner && !selected}
              onClick={() => onPick(c.id)}
              aria-label={owner ? `${c.name} (já escolhido por ${owner})` : c.name}
              aria-pressed={selected}
              title={owner ? `Já escolhido por ${owner}` : undefined}
            >
              <ClubCrest clubId={c.id} size={56} />
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
