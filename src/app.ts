require("dotenv").config();
import { AssistantMessageData, UserMessageParams, ThreadContexts } from "./types";
import { assistant } from "./assistantConfig";
const { App, LogLevel, Assistant } = require("@slack/bolt");
const { OpenAI } = require("openai");
const helmet = require("helmet");
const express = require("express");
const winston = require("winston");
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
export const openaiAssistantId = process.env.OPENAI_ASSISTANT_ID;
const port = process.env.PORT || 3000;

/** Winston Logger Setup */
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

// Slack App Initialization
const app = new App({
  token: slackBotToken,
  signingSecret: slackSigningSecret,
  // Enable/Uncomment below for debugging
  // logLevel: LogLevel.DEBUG, // or LogLevel.INFO
});

// OpenAI Setup
export const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Store thread IDs per channel/thread combination
// In production I will monitor memory and decie if a LRU or Periodic cleanup is needed
export const threadContexts: ThreadContexts = {};

// Run OpenAI Assistant
export async function runAssistant(assistantId: string, threadId: any, userInput: string) {
  try {
    //  Adding a Message in the Thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    // Run the Assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Check the Run status and retrieve the Assistant's response
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

    while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed" &&
      runStatus.status !== "cancelled" &&
      runStatus.status !== "expired"
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1 second
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (runStatus.status === "completed") {
      // Retrieve Messages
      const messages = await openai.beta.threads.messages.list(threadId);

      const assistantMessages: AssistantMessageData[] = messages.data.filter(
        (message: any) => message.role === "assistant"
      );

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
    console.error("Error running assistant:", error);
    return `Error: ${error.message}`;
  }
}

// Assistant Configuration was here new Assistant

app.assistant(assistant);

(async () => {
  try {
    await app.start(port);
    app.logger.info("⚡️ Slack Bolt K-Bot app is running!");
    const expressApp = express();
    expressApp.use(helmet());
    expressApp.listen(port, () => {
      logger.info(`Express server listening on port ${port}`);
    });
  } catch (error) {
    app.logger.error("Failed to start the app", error);
  }
})();
