// src/main/ai/AiKeyStore.ts
import { safeStorage } from 'electron'

// Note: isAvailable() should return true before calling encrypt() or decrypt()
export class AiKeyStore {
  encrypt(plaintext: string): string {
    return safeStorage.encryptString(plaintext).toString('base64')
  }

  decrypt(encrypted: string): string {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch (err) {
      throw new Error(`Failed to decrypt key: ${err}`)
    }
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
}
