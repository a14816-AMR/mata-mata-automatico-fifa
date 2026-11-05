import Modal from '../../components/Modal'
import ClubCrest from '../../components/ClubCrest'
import { CLUBS } from '../../lib/clubs'

/** Seleção visual: apenas os logótipos dos clubes. Várias duplas podem ter o mesmo clube. */
export default function ClubPicker({ value, onPick, onClose }) {
  return (
    <Modal title="Escolher clube" onClose={onClose} wide>
      <div className="club-grid">
        {CLUBS.map((c) => {
          const selected = value === c.id
          return (
            <button
              key={c.id}
              type="button"
              className={`club-opt ${selected ? 'is-selected' : ''}`}
              onClick={() => onPick(c.id)}
              aria-label={c.name}
              aria-pressed={selected}
              title={c.name}
            >
              <ClubCrest clubId={c.id} size={56} />
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
