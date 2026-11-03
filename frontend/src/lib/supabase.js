import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// A chave anon só tem permissão de leitura (RLS). Usada apenas para o Realtime.
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null
