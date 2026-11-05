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
import Bracket from '../../components/Bracket'
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

/** Só os confrontos que mudaram em relação ao último estado gravado. */
function diffSlots(next, saved) {
  const byPos = Object.fromEntries(saved.map((s) => [s.position, s]))
  return next.filter((s) => {
    const o = byPos[s.position]
    return !o || o.team1_id !== s.team1_id || o.team2_id !== s.team2_id
  })
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

/** Dupla já colocada no chaveamento: arrastável, com o visual da linha do cartão. */
function PlacedTeam({ team, selected, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: team.id })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`dslot__team ${selected ? 'is-selected' : ''} ${isDragging ? 'is-ghost' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      aria-pressed={selected}
      {...listeners}
      {...attributes}
    >
      <span className="mrow__crest-bg" aria-hidden="true"><ClubCrest clubId={team.club_id} size={80} /></span>
      <span className="mrow__info">
        <span className="mrow__name">{team.name}</span>
        {team.players && <span className="mrow__players">{team.players}</span>}
      </span>
    </button>
  )
}

/** Lugar de uma dupla num confronto, desenhado como a linha de um cartão do chaveamento. */
function Slot({ id, team, selectedId, onSelect, onPlace, label }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const armed = selectedId && selectedId !== team?.id
  return (
    <div
      ref={setNodeRef}
      className={`mrow dslot ${isOver ? 'is-over' : ''} ${team ? 'is-filled' : ''} ${armed ? 'is-armed' : ''}`}
      onClick={() => armed && onPlace(id)}
      role={armed ? 'button' : undefined}
      aria-label={armed ? `Colocar em ${label}` : undefined}
    >
      {team ? (
        <PlacedTeam team={team} selected={selectedId === team.id} onClick={armed ? () => onPlace(id) : () => onSelect(team.id)} />
      ) : (
        <span className="mrow__info dslot__ph"><span className="mrow__name mrow__name--muted">{label}</span></span>
      )}
    </div>
  )
}

/** Confronto da 1.ª fase editável, no lugar do cartão normal do chaveamento. */
function DrawMatch({ slot, teamsById, selectedId, onSelect, onPlace, style }) {
  const bye = !!slot.team1_id !== !!slot.team2_id
  const empty = !slot.team1_id && !slot.team2_id
  return (
    <div className={`match draw-card ${bye ? 'is-bye' : ''} ${empty ? 'is-empty' : ''}`} style={style}>
      <Slot id={slotId(slot.position, 1)} team={teamsById[slot.team1_id]} selectedId={selectedId} onSelect={onSelect} onPlace={onPlace} label="Largar dupla aqui" />
      <Slot id={slotId(slot.position, 2)} team={teamsById[slot.team2_id]} selectedId={selectedId} onSelect={onSelect} onPlace={onPlace} label={slot.team1_id ? 'Vazio = BYE' : 'Largar dupla aqui'} />
      <span className="draw-card__tag">{bye ? 'BYE' : `Confronto ${slot.position + 1}`}</span>
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
  const [saving, setSaving] = useState('idle') // idle | saving | error
  const [busy, setBusy] = useState(false)
  const saved = useRef(slotsFromState(state)) // último layout confirmado pelo servidor
  const queued = useRef(null) // layout mais recente por enviar
  const running = useRef(null) // promessa da gravação em curso
  const pending = useRef(false)

  // Sincroniza com o servidor (ex.: outra janela) só quando não há gravação pendente.
  useEffect(() => {
    if (pending.current) return
    const fresh = slotsFromState(state)
    saved.current = fresh
    setSlots(fresh)
  }, [state])

  // Grava logo a seguir a cada movimento (sem espera), enviando só os confrontos
  // alterados. Movimentos feitos durante uma gravação seguem juntos na seguinte.
  const flush = useCallback(() => {
    if (running.current) return running.current
    running.current = (async () => {
      let last = null
      try {
        while (queued.current) {
          const next = queued.current
          queued.current = null
          const changed = diffSlots(next, saved.current)
          if (!changed.length) continue
          setSaving('saving')
          last = await api.saveLayout(tid, changed)
          saved.current = next
        }
        pending.current = false
        setSaving('idle')
        if (last) setState(last)
      } catch (e) {
        queued.current = null
        pending.current = false
        setSaving('error')
        toast(e.message, 'error')
        setSlots(saved.current)
      } finally {
        running.current = null
      }
    })()
    return running.current
  }, [tid, setState, toast])

  const persist = useCallback((next) => {
    pending.current = true
    queued.current = next
    flush()
  }, [flush])

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
      await flush()
      setState(await api.start(tid))
      toast('Torneio iniciado! Já pode registar resultados.', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  // Chaveamento com o layout local (atualiza no momento, antes de o servidor responder).
  const bracketIdx = useMemo(() => {
    const byPos = Object.fromEntries(slots.map((s) => [s.position, s]))
    return indexState({
      ...state,
      matches: state.matches.map((m) => (m.round === 1 && byPos[m.position] ? { ...m, ...byPos[m.position] } : m)),
    })
  }, [state, slots])
  const slotByPos = Object.fromEntries(slots.map((s) => [s.position, s]))
  const activeTeam = activeId ? idx.teamsById[activeId] : null
  const onSelect = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onPlace = (target) => place(selectedId, target)
  const renderMatch = (n, style) => n.round === 1 && slotByPos[n.match.position] && (
    <DrawMatch key={n.match.id} slot={slotByPos[n.match.position]} teamsById={idx.teamsById} selectedId={selectedId} onSelect={onSelect} onPlace={onPlace} style={style} />
  )

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
          Arraste cada dupla para um lugar no chaveamento (ou toque numa dupla e depois no lugar). Arrastar para um lugar
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
            <Pool teams={poolTeams} selectedId={selectedId} onSelect={onSelect} onPlace={onPlace} />
          </aside>
          <div className="draw__bracket">
            <Bracket idx={bracketIdx} draft inlineTools renderMatch={renderMatch} />
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTeam ? <TeamChip team={activeTeam} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <div className="actions-bar">
        <span className="actions-bar__status">
          {{ idle: 'Guardado', saving: 'A guardar…', error: 'Erro ao guardar' }[saving]}
          {!ready && ` · ${poolTeams.length ? `${poolTeams.length} por colocar` : ''}${poolTeams.length && empty ? ' · ' : ''}${empty ? `${empty} confronto(s) vazio(s)` : ''}`}
        </span>
        <button className="btn btn--ghost" onClick={backToSetup} disabled={busy}>← Duplas</button>
        <button className="btn" onClick={clearAll} disabled={busy || placed.size === 0}>Limpar</button>
        <button className="btn btn--primary" onClick={start} disabled={busy || !ready}>Iniciar torneio</button>
      </div>
    </div>
  )
}
