import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords.ts'

describe('passwords', () => {
  it('accepts the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored).toMatch(/^scrypt\$17\$8\$1\$/)
    expect(stored).not.toContain('correct horse')
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'bcrypt$whatever')).toBe(false)
  })
})
