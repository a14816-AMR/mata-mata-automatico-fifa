import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import ClubCrest from '../../components/ClubCrest'
import { api } from '../../lib/api'
import { indexState } from '../../lib/bracket'
import { useToast } from '../../components/Toast'

const POOL = 'pool'
const slotId = (pos, n) => `slot:${pos}:${n}`

function slotsFromState(state) {
  return state.matches
    .filter((m) => m.round === 1)
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ position: m.position, team1_id: m.team1_id, team2_id: m.team2_id }))
}

/** Move uma dupla para um lugar; se estiver ocupado, troca as duas duplas. */
function moveTeam(slots, teamId, target) {
  const next = slots.map((s) => ({ ...s }))
  let from = null
  for (const s of next) {
    if (s.team1_id === teamId) { from = [s, 'team1_id']; s.team1_id = null }
    if (s.team2_id === teamId) { from = [s, 'team2_id']; s.team2_id = null }
  }
  if (target === POOL) return next
  const [, pos, n] = target.split(':')
  const dest = next.find((s) => s.position === Number(pos))
  const key = n === '1' ? 'team1_id' : 'team2_id'
  const occupant = dest[key]
  dest[key] = teamId
  if (occupant && occupant !== teamId && from) from[0][from[1]] = occupant
  return next
}

function TeamChip({ team, selected, onSelect, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: team.id, disabled: overlay })
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      className={`chip ${selected ? 'is-selected' : ''} ${isDragging ? 'is-ghost' : ''} ${overlay ? 'is-overlay' : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect?.(team.id) }}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      aria-pressed={selected}
    >
      <ClubCrest clubId={team.club_id} size={24} />
      <span className="chip__name">{team.name}</span>
    </button>
  )
}

function Slot({ id, team, selectedId, onSelect, onPlace, label }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const armed = selectedId && selectedId !== team?.id
  return (
    <div
      ref={setNodeRef}
      className={`slot ${isOver ? 'is-over' : ''} ${team ? 'is-filled' : ''} ${armed ? 'is-armed' : ''}`}
      onClick={() => armed && onPlace(id)}
      role={armed ? 'button' : undefined}
      aria-label={armed ? `Colocar em ${label}` : undefined}
    >
      {team
        ? <TeamChip team={team} selected={selectedId === team.id} onSelect={armed ? () => onPlace(id) : onSelect} />
        : <span className="slot__ph">{label}</span>}
    </div>
  )
}

function Pool({ teams, selectedId, onSelect, onPlace }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL })
  const armed = selectedId && !teams.some((t) => t.id === selectedId)
  return (
    <div
      ref={setNodeRef}
      className={`pool ${isOver ? 'is-over' : ''} ${armed ? 'is-armed' : ''}`}
      onClick={() => armed && onPlace(POOL)}
    >
      <div className="pool__head">
        <h3>Duplas por colocar</h3>
        <span className="pool__count">{teams.length}</span>
      </div>
      {teams.length ? (
        <div className="pool__chips">
          {teams.map((t) => <TeamChip key={t.id} team={t} selected={selectedId === t.id} onSelect={onSelect} />)}
        </div>
      ) : (
        <p className="pool__empty">Todas as duplas estão colocadas.</p>
      )}
    </div>
  )
}

export default function DrawStep({ state, setState }) {
  const toast = useToast()
  const tid = state.tournament.id
  const idx = useMemo(() => indexState(state), [state])
  const [slots, setSlots] = useState(() => slotsFromState(state))
  const [selectedId, setSelectedId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [saving, setSaving] = useState('idle') // idle | pending | saving | error
  const [busy, setBusy] = useState(false)
  const saveTimer = useRef(null)
  const pending = useRef(false)

  // Sincroniza com o servidor (ex.: outra janela) só quando não há gravação pendente.
  useEffect(() => {
    if (!pending.current) setSlots(slotsFromState(state))
  }, [state])

  const persist = useCallback((next) => {
    pending.current = true
    setSaving('pending')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving('saving')
      try {
        const s = await api.saveLayout(tid, next)
        pending.current = false
        setSaving('idle')
        setState(s)
      } catch (e) {
        pending.current = false
        setSaving('error')
        toast(e.message, 'error')
        setSlots(slotsFromState(state))
      }
    }, 400)
  }, [tid, setState, state, toast])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const place = (teamId, target) => {
    if (!teamId) return
    const next = moveTeam(slots, teamId, target)
    setSlots(next)
    persist(next)
    setSelectedId(null)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const placed = new Set(slots.flatMap((s) => [s.team1_id, s.team2_id]).filter(Boolean))
  const poolTeams = idx.teams.filter((t) => !placed.has(t.id))
  const size = state.tournament.bracket_size
  const byesNeeded = size - idx.teams.length
  const byes = slots.filter((s) => !!s.team1_id !== !!s.team2_id).length
  const empty = slots.filter((s) => !s.team1_id && !s.team2_id).length
  const ready = poolTeams.length === 0 && empty === 0
  const nextName = idx.roundName(2)

  const clearAll = () => {
    if (!window.confirm('Retirar todas as duplas dos confrontos?')) return
    const next = slots.map((s) => ({ ...s, team1_id: null, team2_id: null }))
    setSlots(next); persist(next)
  }

  const backToSetup = async () => {
    if (!window.confirm('Voltar ao registo de duplas? A organização dos confrontos será apagada.')) return
    setBusy(true)
    try { setState(await api.backToSetup(tid)) } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const start = async () => {
    const byeNames = slots
      .filter((s) => !!s.team1_id !== !!s.team2_id)
      .map((s) => idx.teamsById[s.team1_id || s.team2_id]?.name)
    const msg = byeNames.length
      ? `Iniciar o torneio?\n\nPassagem direta (BYE) para: ${byeNames.join(', ')}.\n\nDepois de iniciado já não é possível mudar os confrontos.`
      : 'Iniciar o torneio? Depois de iniciado já não é possível mudar os confrontos.'
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      clearTimeout(saveTimer.current)
      if (pending.current) { await api.saveLayout(tid, slots); pending.current = false }
      setState(await api.start(tid))
      toast('Torneio iniciado! Já pode registar resultados.', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  // Agrupa os confrontos aos pares que se encontram na fase seguinte.
  const pairs = []
  for (let i = 0; i < slots.length; i += 2) pairs.push(slots.slice(i, i + 2))
  const activeTeam = activeId ? idx.teamsById[activeId] : null
  const onSelect = (id) => setSelectedId((cur) => (cur === id ? null : id))

  return (
    <div className="step">
      <div className="panel draw-info">
        <div>
          <strong>{idx.teams.length}</strong> duplas · chaveamento de <strong>{size}</strong> · {slots.length} confrontos em {idx.roundName(1)}
        </div>
        <div className={`draw-info__byes ${byes === byesNeeded && ready ? 'is-ok' : ''}`}>
          BYE escolhidos: <strong>{byes}</strong> / {byesNeeded}
        </div>
        <p className="hint">
          Arraste cada dupla para um confronto (ou toque numa dupla e depois no lugar). Arrastar para um lugar
          ocupado troca as duplas. Uma dupla sozinha num confronto recebe <b>BYE</b> e passa diretamente
          {size > 2 ? ` para ${nextName}` : ''}. Os BYE são decididos apenas por si.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => { setActiveId(e.active.id); setSelectedId(null) }}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={(e) => {
          setActiveId(null)
          if (e.over) place(e.active.id, e.over.id)
        }}
      >
        <div className="draw">
          <aside className="draw__pool">
            <Pool teams={poolTeams} selectedId={selectedId} onSelect={onSelect} onPlace={(target) => place(selectedId, target)} />
          </aside>
          <div className="draw__matches">
            {pairs.map((pair, pi) => (
              <div key={pi} className="pair">
                {size > 2 && <span className="pair__label">→ {nextName} · jogo {pi + 1}</span>}
                {pair.map((s) => {
                  const bye = !!s.team1_id !== !!s.team2_id
                  return (
                    <div key={s.position} className={`draw-match ${bye ? 'is-bye' : ''} ${!s.team1_id && !s.team2_id ? 'is-empty' : ''}`}>
                      <div className="draw-match__head">
                        <span>Confronto {s.position + 1}</span>
                        {bye && <span className="badge">BYE</span>}
                      </div>
                      <Slot id={slotId(s.position, 1)} team={idx.teamsById[s.team1_id]} selectedId={selectedId} onSelect={onSelect} onPlace={(t) => place(selectedId, t)} label="Largar dupla aqui" />
                      <span className="draw-match__vs">vs</span>
                      <Slot id={slotId(s.position, 2)} team={idx.teamsById[s.team2_id]} selectedId={selectedId} onSelect={onSelect} onPlace={(t) => place(selectedId, t)} label={s.team1_id ? 'Vazio = BYE' : 'Largar dupla aqui'} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTeam ? <TeamChip team={activeTeam} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <div className="actions-bar">
        <span className="actions-bar__status">
          {{ idle: 'Guardado', pending: 'Alterações por guardar…', saving: 'A guardar…', error: 'Erro ao guardar' }[saving]}
          {!ready && ` · ${poolTeams.length ? `${poolTeams.length} por colocar` : ''}${poolTeams.length && empty ? ' · ' : ''}${empty ? `${empty} confronto(s) vazio(s)` : ''}`}
        </span>
        <button className="btn btn--ghost" onClick={backToSetup} disabled={busy}>← Duplas</button>
        <button className="btn" onClick={clearAll} disabled={busy || placed.size === 0}>Limpar</button>
        <button className="btn btn--primary" onClick={start} disabled={busy || !ready}>Iniciar torneio</button>
      </div>
    </div>
  )
}
