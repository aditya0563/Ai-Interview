import { db } from "@repo/database";
import type { Context } from "@repo/trpc/server";

export function createContext(): Context {
  return { db };
}
