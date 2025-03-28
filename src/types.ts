export interface SlackMessage {
  text: string;
  channel: string;
  thread_ts: string;
  bot_id?: string;
  ts: string;
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
export interface AssistantMessageData {
  role: string;
  content: any;
}
