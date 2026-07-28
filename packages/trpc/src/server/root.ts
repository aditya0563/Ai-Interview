import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { interviewsRouter } from "./routers/interviews";
import { reportsRouter } from "./routers/reports";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  users: usersRouter,
  interviews: interviewsRouter,
  reports: reportsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
