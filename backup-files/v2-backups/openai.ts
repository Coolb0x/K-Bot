import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function runAssistant(assistantId: string, userInput: string): Promise<string> {
  try {
    const emptyThread = await openai.beta.threads.create();
    const threadId = emptyThread.id;

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

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
      const messages = await openai.beta.threads.messages.list(threadId);
      const assistantMessages = messages.data.filter(message => message.role === "assistant");

      if (assistantMessages.length > 0) {
        return assistantMessages[0].content[0].text.value;
      } else {
        return "Assistant provided no response.";
      }
    } else {
      return `Run failed with status: ${runStatus.status}`;
    }
  } catch (error: any) {
    throw new Error(`Error running assistant: ${error.message}`);
  }
}
