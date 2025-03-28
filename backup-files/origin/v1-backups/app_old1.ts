import {
  MessagesListResponse,
  AssistantMessage,
  UserMessageParams,
  ThreadHistoryMessage,
  ThreadMessage,
} from "./types";

const { App, LogLevel, Assistant } = require("@slack/bolt");
require("dotenv").config();
const { OpenAI } = require("openai");

const helmet = require("helmet");
const express = require("express");
const winston = require("winston");

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const port = process.env.PORT || 3000;

// const assistantId = process.env.OPENAI_ASSISTANT_ID;

/** Logger Setup */
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

/** Slack App Initialization */
const app = new App({
  token: slackBotToken,
  signingSecret: slackSigningSecret,
  logLevel: LogLevel.INFO,
});

/** OpenAI Setup */
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// If added a system message, it will be prepended to the conversation - currently not used as it gives worse results
const DEFAULT_SYSTEM_CONTENT = ``;

async function runAssistant(assistantId: string, userInput: string) {
  try {
    // Create an empty thread
    const emptyThread = await openai.beta.threads.create();
    const threadId = emptyThread.id;

    // Adding a Message in the Thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    // Run the AI Assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Check Run status and retrieve the AI Assistant's response
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

    while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed" &&
      runStatus.status !== "cancelled" &&
      runStatus.status !== "expired"
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (runStatus.status === "completed") {
      // Retrieve Messages
      const messages = await openai.beta.threads.messages.list(threadId);

      const messagesData: MessagesListResponse = messages as MessagesListResponse;

      const assistantMessages: AssistantMessage[] = messagesData.data.filter(
        message => message.role === "assistant"
      ) as AssistantMessage[];

      if (assistantMessages.length > 0) {
        const response = assistantMessages[0].content[0].text.value;
        return response;
      } else {
        return "Assistant provided no response.";
      }
    } else {
      return `Run failed with status: ${runStatus.status}`;
    }
  } catch (error: any) {
    logger.error("Error running assistant:", error);
    return `Error: ${error.message}`;
  }
}

const assistant = new Assistant({
  userMessage: async ({
    client,
    logger,
    message,
    getThreadContext,
    say,
    setTitle,
    setStatus,
  }: UserMessageParams) => {
    const { channel, thread_ts } = message;

    try {
      await setTitle(message.text);
      await setStatus("is typing..");

      const thread = await client.conversations.replies({
        channel,
        ts: thread_ts,
        oldest: thread_ts,
      });
      //==================

      const userMessage = { role: "user", content: message.text };

      const threadHistory: ThreadHistoryMessage[] = thread.messages.map((m: ThreadMessage) => {
        const role: "assistant" | "user" = m.bot_id ? "assistant" : "user";
        return { role, content: m.text };
      });

      const messages = [{ role: "system", content: DEFAULT_SYSTEM_CONTENT }, ...threadHistory, userMessage];
      const response = await runAssistant("asst_Bcy8adckdCKjQOPT2Gebjz5K", JSON.stringify(messages));
      await say({ text: response });
      // Ensure assistantId is a string before calling runAssistant
      // if (typeof assistantId === "string") {
      //   const response = await runAssistant("asst_Bcy8adckdCKjQOPT2Gebjz5K", JSON.stringify(messages));

      //   //==================

      //   await say({ text: response });
      // } else {
      //   await say({ text: "Error: Assistant ID is not configured correctly." });
      //   logger.error("Assistant ID is not a string:", assistantId);
      // }
    } catch (e) {
      logger.error(e);
      await say({ text: "Sorry, something went wrong!" });
    }
  },
  // The below threadStarted is the default behavior when a thread is started and required by the Assistant, so only logger is added
  threadStarted: async ({ logger }: { logger: any }, say: any) => {
    try {
      await say({ text: "Hello! I am your assistant." });
    } catch (e) {
      logger.error(e);
    }
  },
});

app.assistant(assistant);

(async () => {
  try {
    await app.start(port);
    app.logger.info("⚡️ Bolt app is running!");

    // Express server for additional security and middleware
    const expressApp = express();
    expressApp.use(helmet());
    expressApp.listen(port, () => {
      logger.info(`Express server listening on port ${port}`);
    });
  } catch (error) {
    app.logger.error("Failed to start the app", error);
  }
})();
