import { App, LogLevel } from "@slack/bolt";
import helmet from "helmet";
import express from "express";
import { logger } from "./logger";
import { userMessageHandler, threadStartedHandler } from "./handlers";

const config = {
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET!,
  slackBotToken: process.env.SLACK_BOT_TOKEN!,
  port: process.env.PORT || 3000,
};

const app = new App({
  token: config.slackBotToken,
  signingSecret: config.slackSigningSecret,
  logLevel: LogLevel.INFO,
});

app.assistant({
  userMessage: userMessageHandler,
  threadStarted: threadStartedHandler,
});

(async () => {
  try {
    await app.start(config.port);
    logger.info("⚡️ Bolt app is running!");

    const expressApp = express();
    expressApp.use(helmet());
    expressApp.listen(config.port, () => {
      logger.info(`Express server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start the app", error);
  }
})();
