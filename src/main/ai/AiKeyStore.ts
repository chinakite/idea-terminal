// src/main/ai/AiKeyStore.ts
import { safeStorage } from 'electron'

export class AiKeyStore {
  encrypt(plaintext: string): string {
    return safeStorage.encryptString(plaintext).toString('base64')
  }

  decrypt(encrypted: string): string {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
}
