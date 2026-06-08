import { existsSync, unlinkSync } from "fs";
import { join } from "path";

const localDir = join(process.cwd(), "uploads");

export function deleteLocalStorageFile(storageKey: string) {
  try {
    const path = join(localDir, storageKey);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // best effort
  }
}
