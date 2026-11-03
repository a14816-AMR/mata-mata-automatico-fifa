import clubs from '../../../shared/clubs.json'

export const CLUBS = clubs
const BY_ID = Object.fromEntries(clubs.map((c) => [c.id, c]))
export const clubById = (id) => BY_ID[id] || null
