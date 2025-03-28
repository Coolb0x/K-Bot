const { Assistant } = require("@slack/bolt");
import { UserMessageParams } from "./types";
import { threadContexts, runAssistant, openaiAssistantId, openai } from "./app";

export const assistant = new Assistant({
  userMessage: async ({ logger, message, say, setTitle, setStatus }: UserMessageParams) => {
    const { channel, thread_ts } = message;
    const contextKey = `${channel}-${thread_ts}`;

    try {
      await setTitle(message.text);
      await setStatus("is typing..");

      // Retrieve or create threadId
      if (!threadContexts[contextKey]) {
        const emptyThread = await openai.beta.threads.create();
        threadContexts[contextKey] = emptyThread.id;
      }
      const threadId = threadContexts[contextKey];

      // Use the existing threadId
      const response = await runAssistant(
        openaiAssistantId || "Error: Missing Assistant ID",
        threadId,
        message.text
      );
      await say({ text: response });
    } catch (e) {
      logger.error(e);
      await say({ text: "Sorry, something went wrong!" });
    }
  },

  // The below threadStarted is the default behavior when a thread is started and required by the Assistant
  threadStarted: async ({ logger, message, client }: { logger: any; message: any; client: any }) => {
    try {
      if (!message || !message.channel) {
        logger.error("Invalid message object: Missing 'channel' property.");
        return;
      }

      await client.chat.postMessage({
        channel: message.channel,
        text: "Hello! I am your assistant.",
        thread_ts: message.ts,
      });
    } catch (e) {
      logger.error(e);
    }
  },
});
