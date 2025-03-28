require("dotenv").config();
import { ThreadContexts } from "./types";
import { assistant } from "./assistant-conf";
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

// run assist function was here

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
