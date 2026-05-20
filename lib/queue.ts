import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const PARSE_QUEUE_NAME = "excel-parse";

export const parseQueue = new Queue(PARSE_QUEUE_NAME, { connection });

export async function enqueueParseJob(uploadId: string) {
  await parseQueue.add(
    "parse-upload",
    { uploadId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );
}

export { connection as redisConnection };
