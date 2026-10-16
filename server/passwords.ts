import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// Passwords are never stored, only a scrypt hash of them with a random salt.
// scrypt is slow and memory-hungry on purpose, so guessing passwords from a
// stolen copy of the users table would take years. Stored as
// "scrypt$<log2 N>$<r>$<p>$<salt>$<hash>" so the cost can be raised later
// without breaking existing hashes.

const LOG_N = 17
const R = 8
const P = 1
const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, { N: 2 ** LOG_N, r: R, p: P })
  return ['scrypt', LOG_N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: 2 ** Number(logN), r: Number(r), p: Number(p) })
  // Compares in constant time, so response times don't leak how close a guess was.
  return key.length === expected.length && timingSafeEqual(key, expected)
}
