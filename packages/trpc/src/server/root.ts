import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { interviewsRouter } from "./routers/interviews";
import { reportsRouter } from "./routers/reports";

export const appRouter = router({
  users: usersRouter,
  interviews: interviewsRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
