import {
  createAgentInput,
  agent,
  listAgentsOutput,
  resetAgentPasswordInput,
  setAgentActiveInput,
} from '@repo/contract/agents';
import { adminProcedure, router } from '#lib/trpc';
import {
  createAgent,
  listAgents,
  resetAgentPassword,
  setAgentActive,
} from '#features/agents/service';

export const agentsRouter = router({
  list: adminProcedure
    .output(listAgentsOutput)
    .query(({ ctx }) => listAgents(ctx.headers)),
  create: adminProcedure
    .input(createAgentInput)
    .output(agent)
    .mutation(({ input }) => createAgent(input)),
  setActive: adminProcedure
    .input(setAgentActiveInput)
    .mutation(({ ctx, input }) => setAgentActive(ctx.headers, input)),
  resetPassword: adminProcedure
    .input(resetAgentPasswordInput)
    .mutation(({ ctx, input }) => resetAgentPassword(ctx.headers, input)),
});
