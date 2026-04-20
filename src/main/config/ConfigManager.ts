// src/main/config/ConfigManager.ts
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { AppConfig, DEFAULT_CONFIG } from '../../shared/types'

export class ConfigManager {
  private readonly configPath: string

  constructor(userDataPath: string) {
    this.configPath = join(userDataPath, 'config.json')
  }

  load(): AppConfig {
    if (!existsSync(this.configPath)) {
      return structuredClone(DEFAULT_CONFIG)
    }
    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      // Shallow merge: new top-level keys get defaults, but nested sub-object keys do not.
      // If DEFAULT_CONFIG gains nested required keys in the future, a recursive merge will be needed.
      return { ...structuredClone(DEFAULT_CONFIG), ...JSON.parse(raw) }
    } catch {
      const backupPath = this.configPath + '.bak'
      copyFileSync(this.configPath, backupPath)
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  save(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }
}
