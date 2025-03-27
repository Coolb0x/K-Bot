export interface SlackMessage {
  text: string;
  channel: string;
  thread_ts: string;
  bot_id?: string;
  ts: string;
}

export interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ThreadMessage {
  bot_id?: string;
  text: string;
}

export interface ThreadHistoryMessage {
  role: "assistant" | "user";
  content: string;
}

export interface UserMessageParams {
  client: any;
  logger: any;
  message: SlackMessage;
  getThreadContext: any;
  say: (message: { text: string }) => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  setStatus: (status: string) => Promise<void>;
}

export interface MessageContent {
  type: string;
  text: {
    value: string;
  };
}

export interface AssistantMessage {
  role: string;
  content: MessageContent[];
}
export interface MessageData {
  data: AssistantMessage[];
}

export interface MessagesListResponse {
  data: AssistantMessage[];
  object: string;
  first_id: string;
  last_id: string;
  has_more: boolean;
}

// Interface for Slack message
export interface SlackMessage {
  text: string;
  channel: string;
  thread_ts: string;
  bot_id?: string;
  ts: string;
}

// Interface for OpenAI message
export interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Interface for Assistant parameters
export interface AssistantParams {
  client: any;
  logger: any;
  message: SlackMessage;
  say: (message: { text: string }) => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  setStatus: (status: string) => Promise<void>;
}

// Interface for ThreadStarted parameters
export interface ThreadStartedParams {
  client: any;
  logger: any;
  message: SlackMessage;
  say: (message: { text: string }) => Promise<void>;
}
