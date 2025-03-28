// Interfaces

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

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

/** Slack App Initialization */
const app = new App({
  token: slackBotToken,
  signingSecret: slackSigningSecret,
  // logLevel: LogLevel.DEBUG, // or LogLevel.INFO
});

/** OpenAI Setup */
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

//No system message for better results
// const DEFAULT_SYSTEM_CONTENT = ``;

// !Store thread IDs per channel/thread combination
const threadContexts: { [key: string]: any } = {};

async function runAssistant(assistantId: string, threadId: any, userInput: string) {
  try {
    //  Adding a Message in the Thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    // 3. Run the Assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // 4. Check the Run status and retrieve the Assistant's response
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
      // 5. Retrieve Messages
      const messages = await openai.beta.threads.messages.list(threadId);

      //Check inferences for message and fix TS
      interface AssistantMessageData {
        role: string;
        content: any;
      }

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

      //! This adds context directly to the thread via the slack conversation and will pass to openai the whole thread as one message
      // ! it is not needed as the logic here is to create one threadId and each consecutive message will be added to the thread
      //   let messages;

      //     if (thread.messages.length <= 1) {
      //     messages = [
      //       { role: "system", content: DEFAULT_SYSTEM_CONTENT },
      //       { role: "user", content: message.text },
      //     ];
      //   } else {
      //       const threadHistory = thread.messages.slice(0, -1).map(m => {
      //       const role = m.bot_id ? "assistant" : "user";
      //       return { role, content: m.text };
      //     });
      //     messages = [
      //       { role: "system", content: DEFAULT_SYSTEM_CONTENT },
      //       ...threadHistory,
      //       { role: "user", content: message.text },
      //     ];
      //   }

      // Use the existing threadId
      const response = await runAssistant("asst_Bcy8adckdCKjQOPT2Gebjz5K", threadId, message.text);

      await say({ text: response });
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
    await app.start(process.env.PORT || 3000);
    app.logger.info("⚡️ Bolt app is running!");
  } catch (error) {
    app.logger.error("Failed to start the app", error);
  }
})();
