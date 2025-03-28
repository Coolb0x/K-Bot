require("dotenv").config();
import { assistant } from "./assistant-conf";
const { App, LogLevel } = require("@slack/bolt");

const helmet = require("helmet");
const express = require("express");
const winston = require("winston");
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
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
