import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ SUPABASE_URL и SUPABASE_ANON_KEY должны быть указаны в .env')
  process.exit(1)
}

async function fetchWithRetry(input, init, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      if (i === retries) throw err
      const delay = 200 * (i + 1)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithRetry },
})
