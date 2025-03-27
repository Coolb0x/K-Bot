import { runAssistant } from "./openai";
import { SlackMessage } from "./types";
import { logger } from "./logger";

export const userMessageHandler = async ({ client, logger, message, say, setTitle, setStatus }: any) => {
  const { channel, thread_ts, text } = message;

  try {
    await setTitle(text);
    await setStatus("is typing..");

    const thread = await client.conversations.replies({
      channel,
      ts: thread_ts,
      oldest: thread_ts,
    });

    const userMessage = { role: "user", content: text };
    const threadHistory = thread.messages.map((m: any) => ({
      role: m.bot_id ? "assistant" : "user",
      content: m.text,
    }));

    const messages = [{ role: "system", content: "" }, ...threadHistory, userMessage];
    const response = await runAssistant(process.env.OPENAI_ASSISTANT_ID!, JSON.stringify(messages));
    await say({ text: response });
  } catch (e) {
    logger.error(e);
    await say({ text: "Sorry, something went wrong!" });
  }
};

export const threadStartedHandler = async ({ logger }: any, say: any) => {
  try {
    await say({ text: "Hello! I am your assistant." });
  } catch (e) {
    logger.error(e);
  }
};
