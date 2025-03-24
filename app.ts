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
  // Enable/Disable debug logging for development with below line
  // logLevel: LogLevel.DEBUG,
});

/** OpenAI Setup */
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// If added a system message, it will be prepended to the conversation - currently not used as it gives worse results
const DEFAULT_SYSTEM_CONTENT = ``;

async function runAssistant(assistantId, userInput) {
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
      const assistantMessages = messages.data.filter(message => message.role === "assistant");

      if (assistantMessages.length > 0) {
        const response = assistantMessages[0].content[0].text.value;
        return response;
      } else {
        return "Assistant provided no response.";
      }
    } else {
      return `Run failed with status: ${runStatus.status}`;
    }
  } catch (error) {
    console.error("Error running assistant:", error);
    return `Error: ${error.message}`;
  }
}

const assistant = new Assistant({
  userMessage: async ({ client, logger, message, getThreadContext, say, setTitle, setStatus }) => {
    const { channel, thread_ts } = message;

    try {
      await setTitle(message.text);
      await setStatus("is typing..");

      const thread = await client.conversations.replies({
        channel,
        ts: thread_ts,
        oldest: thread_ts,
      });

      const userMessage = { role: "user", content: message.text };
      const threadHistory = thread.messages.map(m => {
        const role = m.bot_id ? "assistant" : "user";
        return { role, content: m.text };
      });

      const messages = [{ role: "system", content: DEFAULT_SYSTEM_CONTENT }, ...threadHistory, userMessage];
      const response = await runAssistant("asst_Bcy8adckdCKjQOPT2Gebjz5K", JSON.stringify(messages));
      await say({ text: response });
    } catch (e) {
      logger.error(e);
      await say({ text: "Sorry, something went wrong!" });
    }
  },
  // The below threadStarted is the default behavior when a thread is started and required by the Assistant, so only logger is added
  threadStarted: async ({ client, logger, message, say }) => {
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
