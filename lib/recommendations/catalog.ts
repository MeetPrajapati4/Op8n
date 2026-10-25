export interface SuggestionPreset {
  itemId: string;
  title: string;
  description: string;
  category: 'Webhooks' | 'Scheduling' | 'CRM & Leads' | 'DevOps & Alerts' | 'Messaging' | 'AI & Data';
  tags: string[];
  isDefault: boolean;
  globalPopularityScore: number;
}

export const DEFAULT_SUGGESTIONS_CATALOG: SuggestionPreset[] = [
  {
    itemId: 'webhook-slack-sheets',
    title: 'Webhook → Slack + Google Sheets',
    description: 'When a webhook receives data, post an alert to Slack and append a new row to Google Sheets.',
    category: 'Webhooks',
    tags: ['webhook', 'slack', 'sheets', 'integration'],
    isDefault: true,
    globalPopularityScore: 95,
  },
  {
    itemId: 'daily-hn-digest',
    title: 'Daily Hacker News Digest',
    description: 'Every day at 9am, fetch top tech posts via HTTP and send them as a formatted Telegram message.',
    category: 'Scheduling',
    tags: ['cron', 'schedule', 'http', 'telegram'],
    isDefault: true,
    globalPopularityScore: 88,
  },
  {
    itemId: 'lead-capture-notion',
    title: 'Lead Capture → Notion + Gmail',
    description: 'When a Typeform webhook fires, add the customer lead to Notion CRM and send a personalized welcome email via Gmail.',
    category: 'CRM & Leads',
    tags: ['typeform', 'notion', 'gmail', 'crm', 'webhook'],
    isDefault: true,
    globalPopularityScore: 92,
  },
  {
    itemId: 'uptime-monitor-slack',
    title: '10-Minute Uptime Monitor',
    description: 'Every 10 minutes, send an HTTP ping to my production URL. If status is not 200, trigger an immediate incident alert in Slack.',
    category: 'DevOps & Alerts',
    tags: ['uptime', 'http', 'slack', 'monitoring', 'schedule'],
    isDefault: true,
    globalPopularityScore: 84,
  },
  {
    itemId: 'sheets-whatsapp-alerts',
    title: 'Google Sheets → WhatsApp Alerts',
    description: 'When a new order row is appended to Google Sheets, send an instant WhatsApp order confirmation via HTTP API.',
    category: 'Messaging',
    tags: ['sheets', 'whatsapp', 'messaging', 'http'],
    isDefault: true,
    globalPopularityScore: 81,
  },
  {
    itemId: 'ai-email-summarizer',
    title: 'AI Email Summarizer → Notion Digest',
    description: 'Monitor incoming Gmail messages, summarize long email threads with AI, and archive actionable bullets into Notion.',
    category: 'AI & Data',
    tags: ['gmail', 'gemini', 'ai', 'notion', 'productivity'],
    isDefault: true,
    globalPopularityScore: 79,
  },
  {
    itemId: 'github-issue-telegram',
    title: 'GitHub Issues → Telegram Alerts',
    description: 'When a new GitHub issue or pull request is opened, format the payload and dispatch an alert to the developer Telegram channel.',
    category: 'DevOps & Alerts',
    tags: ['github', 'webhook', 'telegram', 'devops'],
    isDefault: false,
    globalPopularityScore: 65,
  },
  {
    itemId: 'stripe-invoice-sync',
    title: 'Stripe Payment → Airtable Ledger',
    description: 'Listen for Stripe charge.succeeded webhooks, calculate tax/fees in Code node, and sync transaction record to Airtable.',
    category: 'CRM & Leads',
    tags: ['stripe', 'webhook', 'airtable', 'finance'],
    isDefault: false,
    globalPopularityScore: 72,
  },
  {
    itemId: 'file-processor-s3',
    title: 'Webhook File Processor → Cloud Storage',
    description: 'When a webhook receives a file payload URL, download the binary via HTTP, transform in JavaScript Code node, and store in S3.',
    category: 'AI & Data',
    tags: ['webhook', 'http', 's3', 'storage', 'data'],
    isDefault: false,
    globalPopularityScore: 58,
  },
];
