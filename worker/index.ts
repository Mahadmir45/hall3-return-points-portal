import { Worker } from "bullmq";
import { redisConnection, PARSE_QUEUE_NAME } from "@/lib/queue";
import { processUpload } from "@/lib/excel/processUpload";

const worker = new Worker(
  PARSE_QUEUE_NAME,
  async (job) => {
    const { uploadId } = job.data as { uploadId: string };
    console.log(`Processing upload ${uploadId}`);
    await processUpload(uploadId);
    console.log(`Finished upload ${uploadId}`);
  },
  { connection: redisConnection, concurrency: 2 },
);

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log("Excel parse worker started");
