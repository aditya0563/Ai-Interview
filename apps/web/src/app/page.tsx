"use client";

import Link from "next/link";
import { Button, Card, CardHeader, CardBody } from "@repo/ui";
import { trpc } from "@/trpc/client";

export default function Home() {
  const { data: users, isLoading, error } = trpc.users.list.useQuery();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Interview AI
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Turborepo · Next.js 15 · tRPC · Drizzle ORM · PostgreSQL
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              tRPC → Drizzle → PostgreSQL
            </h2>
            <p className="text-sm text-zinc-500">
              Live query via <code className="font-mono text-xs">trpc.users.list.useQuery()</code>
            </p>
          </CardHeader>
          <CardBody>
            {isLoading && (
              <p className="text-sm text-zinc-400 animate-pulse">
                Loading users…
              </p>
            )}
            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-950">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Database not connected
                </p>
                <p className="mt-1 text-xs text-red-500">
                  Set <code className="font-mono">DATABASE_URL</code> in your .env and run{" "}
                  <code className="font-mono">pnpm db:push</code>
                </p>
              </div>
            )}
            {users && users.length === 0 && (
              <p className="text-sm text-zinc-500">
                No users yet — run <code className="font-mono text-xs">pnpm db:push</code> and insert a row.
              </p>
            )}
            {users && users.length > 0 && (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((user) => (
                  <li key={user.id} className="py-2">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {user.name ?? "(no name)"}
                    </p>
                    <p className="text-xs text-zinc-400">{user.email}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="flex gap-3 justify-center">
          <Link href="/interview">
            <Button variant="primary" size="md">
              Get Started
            </Button>
          </Link>
          <Link href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="md">
              Documentation
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
