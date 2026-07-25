import Link from "next/link";
import { auth, signIn, signOut } from "../auth";

export default async function Home() {
  // Fetch the active server session
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="flex flex-col items-center gap-8 z-10 text-center">
        
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Interview AI
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Turborepo · Next.js 16 · tRPC · Drizzle ORM · PostgreSQL · Auth.js
          </p>
        </div>

        {/* Authentication State UI */}
        <div className="flex flex-col items-center gap-4 mt-8">
          {session ? (
            <>
              <p className="text-sm text-gray-300">
                Signed in as <span className="font-semibold text-white">{session.user?.name}</span>
              </p>
              <div className="flex gap-4">
                <Link 
                  href="/interview" 
                  className="px-6 py-2 rounded-md bg-white text-black font-medium hover:bg-gray-200 transition-colors"
                >
                  Enter Interview Room
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                >
                  <button 
                    type="submit"
                    className="px-6 py-2 rounded-md border border-gray-600 hover:bg-gray-800 transition-colors"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/interview" });
              }}
            >
              <button 
                type="submit"
                className="px-8 py-3 rounded-md bg-white text-black font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sign in with GitHub
              </button>
            </form>
          )}
        </div>

      </div>
    </main>
  );
}