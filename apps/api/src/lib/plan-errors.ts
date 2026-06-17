import type { FastifyReply } from 'fastify';
import { isPlanLimitError, planLimitReply } from '../services/plan.service.js';

export function replyPlanLimitError(reply: FastifyReply, err: unknown): boolean {
  if (!isPlanLimitError(err)) return false;
  reply.status(403).send(planLimitReply(err));
  return true;
}
