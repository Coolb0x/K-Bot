require("dotenv").config();
import { AssistantMessageData, UserMessageParams } from "./types";
const { App, LogLevel, Assistant } = require("@slack/bolt");
const { OpenAI } = require("openai");
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Slack App Initialization
const app = new App({
  token: slackBotToken,
  signingSecret: slackSigningSecret,
  // Enable/Uncomment below for debugging
  // logLevel: LogLevel.DEBUG, // or LogLevel.INFO
});

// OpenAI Setup
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Store thread IDs per channel/thread combination
const threadContexts: { [key: string]: any } = {};

async function runAssistant(assistantId: string, threadId: any, userInput: string) {
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

const assistant = new Assistant({
  userMessage: async ({ client, logger, message, say, setTitle, setStatus }: UserMessageParams) => {
    const { channel, thread_ts } = message;
    const contextKey = `${channel}-${thread_ts}`;

    try {
      await setTitle(message.text);
      await setStatus("is typing..");

      // Retrieve or create threadId
      if (!threadContexts[contextKey]) {
        // 1. Create an empty thread
        const emptyThread = await openai.beta.threads.create();
        threadContexts[contextKey] = emptyThread.id;
      }
      const threadId = threadContexts[contextKey];

      // if it is the first message in the thread no need to take thread history
      const thread = await client.conversations.replies({
        channel,
        ts: thread_ts,
        oldest: thread_ts,
      });

      // Use the existing threadId
      const response = await runAssistant("asst_Bcy8adckdCKjQOPT2Gebjz5K", threadId, message.text);

      await say({ text: response });
    } catch (e) {
      logger.error(e);
      await say({ text: "Sorry, something went wrong!" });
    }
  },
  // The below threadStarted is the default behavior when a thread is started and required by the Assistant

  threadStarted: async ({ logger, message, client }: { logger: any; message: any; client: any }) => {
    // JUST to debug / remove later
    logger.info("Message object:", message);
    try {
      // Ensure the message object is valid
      if (!message || !message.channel) {
        logger.error("Invalid message object: Missing 'channel' property.");
        return;
      }

      // Use client.chat.postMessage to send a message
      await client.chat.postMessage({
        channel: message.channel,
        text: "Hello! I am your assistant.",
        thread_ts: message.ts, // Optional: If you want to reply in the same thread
      });
    } catch (e) {
      logger.error(e);
    }
  },

  // threadStarted: async ({ logger }: { logger: any }, say: any) => {
  //   try {
  //     await say({ text: "Hello! I am your assistant." });
  //   } catch (e) {
  //     logger.error(e);
  //   }
  // },
});

app.assistant(assistant);

(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    app.logger.info("⚡️ Bolt app is running!");
  } catch (error) {
    app.logger.error("Failed to start the app", error);
  }
})();
