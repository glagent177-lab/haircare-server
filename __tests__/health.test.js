import 'dotenv/config'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import express from 'express'

describe('Server health', () => {
  it('should have required env vars', () => {
    assert.ok(process.env.SUPABASE_URL, 'SUPABASE_URL is set')
    assert.ok(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY is set')
  })

  it('should create express app without error', () => {
    const app = express()
    assert.ok(app)
    assert.equal(typeof app.listen, 'function')
  })
})
