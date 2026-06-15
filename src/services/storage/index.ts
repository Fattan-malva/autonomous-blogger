import { env } from '../../config/env';
import { logger } from '../../config/logger';
import * as fs from 'fs';
import * as path from 'path';

export class StorageService {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.resolve(__dirname, '../../../images');
    this.ensureDirectoryExists(this.basePath);
  }

  async save(filename: string, data: Buffer | string): Promise<string> {
    const filePath = path.join(this.basePath, filename);
    const dir = path.dirname(filePath);

    this.ensureDirectoryExists(dir);
    await fs.promises.writeFile(filePath, data);

    logger.debug(`File saved: ${filename}`);
    return filePath;
  }

  async read(filename: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, filename);
    return fs.promises.readFile(filePath);
  }

  async delete(filename: string): Promise<boolean> {
    const filePath = path.join(this.basePath, filename);
    try {
      await fs.promises.unlink(filePath);
      logger.debug(`File deleted: ${filename}`);
      return true;
    } catch (error) {
      logger.warn(`File not found for deletion: ${filename}`);
      return false;
    }
  }

  async list(dir?: string): Promise<string[]> {
    const searchPath = dir ? path.join(this.basePath, dir) : this.basePath;
    this.ensureDirectoryExists(searchPath);
    return fs.promises.readdir(searchPath);
  }

  async exists(filename: string): Promise<boolean> {
    const filePath = path.join(this.basePath, filename);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPath(filename: string): string {
    return path.join(this.basePath, filename);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const storage = new StorageService();
