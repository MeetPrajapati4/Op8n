import { describe, it, expect } from 'vitest';
import { validateAndRepairWorkflow, autoLayoutPositions } from '@/lib/validator';
import { N8nWorkflow } from '@/lib/n8n-types';

// 5 VALID FIXTURES
const validSimpleWebhookSlack: N8nWorkflow = {
  name: 'Webhook to Slack',
  active: false,
  nodes: [
    {
      id: 'node-1',
      name: 'Webhook Trigger',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: { path: 'webhook-test' },
    },
    {
      id: 'node-2',
      name: 'Slack Alert',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [470, 300],
      parameters: { channel: '#general', text: 'Hello' },
    },
  ],
  connections: {
    'Webhook Trigger': {
      main: [[{ node: 'Slack Alert', type: 'main', index: 0 }]],
    },
  },
  settings: {},
  tags: [],
};

const validScheduleSheets: N8nWorkflow = {
  name: 'Schedule to Sheets',
  active: false,
  nodes: [
    {
      id: 'node-1',
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1,
      position: [250, 300],
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
    },
    {
      id: 'node-2',
      name: 'Fetch API',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 1,
      position: [470, 300],
      parameters: { url: 'https://api.example.com/items' },
    },
    {
      id: 'node-3',
      name: 'Append to Sheet',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 1,
      position: [690, 300],
      parameters: { operation: 'append' },
    },
  ],
  connections: {
    'Schedule Trigger': {
      main: [[{ node: 'Fetch API', type: 'main', index: 0 }]],
    },
    'Fetch API': {
      main: [[{ node: 'Append to Sheet', type: 'main', index: 0 }]],
    },
  },
  settings: {},
  tags: [],
};

const validComplexBranching: N8nWorkflow = {
  name: 'Manual If Branching',
  active: false,
  nodes: [
    {
      id: 'node-1',
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    },
    {
      id: 'node-2',
      name: 'Check Status',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [470, 300],
      parameters: { conditions: {} },
    },
    {
      id: 'node-3',
      name: 'Slack Notification',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [690, 200],
      parameters: {},
    },
    {
      id: 'node-4',
      name: 'Email Send',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 1,
      position: [690, 420],
      parameters: {},
    },
  ],
  connections: {
    'Manual Trigger': {
      main: [[{ node: 'Check Status', type: 'main', index: 0 }]],
    },
    'Check Status': {
      main: [
        [{ node: 'Slack Notification', type: 'main', index: 0 }],
        [{ node: 'Email Send', type: 'main', index: 0 }],
      ],
    },
  },
  settings: {},
  tags: [],
};

const validCodeProcessor: N8nWorkflow = {
  name: 'File Code Pipeline',
  active: false,
  nodes: [
    {
      id: 'node-1',
      name: 'Webhook Inbound',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    },
    {
      id: 'node-2',
      name: 'Data Transformation',
      type: 'n8n-nodes-base.code',
      typeVersion: 1,
      position: [470, 300],
      parameters: { jsCode: 'return items;' },
    },
    {
      id: 'node-3',
      name: 'Airtable Sync',
      type: 'n8n-nodes-base.airtable',
      typeVersion: 1,
      position: [690, 300],
      parameters: {},
    },
  ],
  connections: {
    'Webhook Inbound': {
      main: [[{ node: 'Data Transformation', type: 'main', index: 0 }]],
    },
    'Data Transformation': {
      main: [[{ node: 'Airtable Sync', type: 'main', index: 0 }]],
    },
  },
  settings: {},
  tags: [],
};

const validTelegramBot: N8nWorkflow = {
  name: 'Telegram Router',
  active: false,
  nodes: [
    {
      id: 'node-1',
      name: 'Telegram Trigger',
      type: 'n8n-nodes-base.telegramTrigger',
      typeVersion: 1,
      position: [250, 300],
      parameters: { updates: ['message'] },
    },
    {
      id: 'node-2',
      name: 'Route Command',
      type: 'n8n-nodes-base.switch',
      typeVersion: 1,
      position: [470, 300],
      parameters: {},
    },
    {
      id: 'node-3',
      name: 'Send Reply',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1,
      position: [690, 300],
      parameters: { operation: 'sendMessage' },
    },
  ],
  connections: {
    'Telegram Trigger': {
      main: [[{ node: 'Route Command', type: 'main', index: 0 }]],
    },
    'Route Command': {
      main: [[{ node: 'Send Reply', type: 'main', index: 0 }]],
    },
  },
  settings: {},
  tags: [],
};

// 5 BROKEN FIXTURES
const brokenZeroTriggers = {
  name: 'Broken: Zero Triggers',
  nodes: [
    {
      id: 'node-1',
      name: 'HTTP Fetch',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    },
    {
      id: 'node-2',
      name: 'Slack Post',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [470, 300],
      parameters: {},
    },
  ],
  connections: {
    'HTTP Fetch': {
      main: [[{ node: 'Slack Post', type: 'main', index: 0 }]],
    },
  },
};

const brokenMultipleTriggers = {
  name: 'Broken: Multiple Triggers',
  nodes: [
    {
      id: 'node-1',
      name: 'Webhook 1',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 200],
      parameters: {},
    },
    {
      id: 'node-2',
      name: 'Schedule 2',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1,
      position: [250, 400],
      parameters: {},
    },
    {
      id: 'node-3',
      name: 'Slack Post',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [470, 300],
      parameters: {},
    },
  ],
  connections: {
    'Webhook 1': {
      main: [[{ node: 'Slack Post', type: 'main', index: 0 }]],
    },
  },
};

const brokenDuplicateNodeNames = {
  name: 'Broken: Duplicate Node Names',
  nodes: [
    {
      id: 'node-1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    },
    {
      id: 'node-2',
      name: 'Slack',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [470, 300],
      parameters: {},
    },
    {
      id: 'node-3',
      name: 'Slack', // Duplicate name!
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [690, 300],
      parameters: {},
    },
  ],
  connections: {
    Webhook: {
      main: [[{ node: 'Slack', type: 'main', index: 0 }]],
    },
  },
};

const brokenNonExistentConnectionTarget = {
  name: 'Broken: Connection Target Missing',
  nodes: [
    {
      id: 'node-1',
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    },
  ],
  connections: {
    'Manual Trigger': {
      main: [[{ node: 'GhostNodeThatDoesNotExist', type: 'main', index: 0 }]],
    },
  },
};

const brokenMissingRequiredFields = {
  name: 'Broken: Node Missing Type and Position',
  nodes: [
    {
      id: 'node-1',
      name: 'Invalid Node',
      // Missing type and position!
      parameters: {},
    },
  ],
  connections: {},
};

describe('n8n Workflow Validator & Auto-Repair', () => {
  describe('5 Valid Workflow Fixtures', () => {
    it('validates simple webhook to Slack workflow', () => {
      const res = validateAndRepairWorkflow(validSimpleWebhookSlack);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates scheduled sheets pipeline', () => {
      const res = validateAndRepairWorkflow(validScheduleSheets);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates complex branching workflow', () => {
      const res = validateAndRepairWorkflow(validComplexBranching);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates code transformer to Airtable', () => {
      const res = validateAndRepairWorkflow(validCodeProcessor);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates telegram bot workflow', () => {
      const res = validateAndRepairWorkflow(validTelegramBot);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('5 Broken Workflow Fixtures', () => {
    it('fails when no trigger node exists', () => {
      const res = validateAndRepairWorkflow(brokenZeroTriggers);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.message.includes('trigger node (found 0)'))).toBe(true);
    });

    it('fails when multiple trigger nodes exist', () => {
      const res = validateAndRepairWorkflow(brokenMultipleTriggers);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.message.includes('found 2'))).toBe(true);
    });

    it('fails when duplicate node names are present', () => {
      const res = validateAndRepairWorkflow(brokenDuplicateNodeNames);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.message.includes('Duplicate node name: "Slack"'))).toBe(true);
    });

    it('fails when connection points to non-existent node', () => {
      const res = validateAndRepairWorkflow(brokenNonExistentConnectionTarget);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.message.includes('GhostNodeThatDoesNotExist'))).toBe(true);
    });

    it('fails when required node schema fields are missing', () => {
      const res = validateAndRepairWorkflow(brokenMissingRequiredFields);
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-Repair & Sanitization', () => {
    it('automatically repairs overlapping/missing positions with left-to-right layout', () => {
      const overlappingWorkflow: N8nWorkflow = {
        name: 'Overlapping',
        active: false,
        nodes: [
          {
            id: 'node-1',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [250, 300],
            parameters: {},
          },
          {
            id: 'node-2',
            name: 'Slack',
            type: 'n8n-nodes-base.slack',
            typeVersion: 1,
            position: [250, 300], // Duplicate position!
            parameters: {},
          },
        ],
        connections: {
          Webhook: {
            main: [[{ node: 'Slack', type: 'main', index: 0 }]],
          },
        },
        settings: {},
        tags: [],
      };

      const res = validateAndRepairWorkflow(overlappingWorkflow);
      expect(res.isValid).toBe(true);
      expect(res.repairedWorkflow.nodes[0].position).toEqual([250, 300]);
      expect(res.repairedWorkflow.nodes[1].position).toEqual([470, 300]);
    });

    it('strips hardcoded secret keys and flags credentialsNeeded', () => {
      const workflowWithSecret: N8nWorkflow = {
        name: 'Secret Workflow',
        active: false,
        nodes: [
          {
            id: 'node-1',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            typeVersion: 1,
            position: [250, 300],
            parameters: {},
          },
          {
            id: 'node-2',
            name: 'OpenAI Call',
            type: 'n8n-nodes-base.openAi',
            typeVersion: 1,
            position: [470, 300],
            parameters: {
              apiKey: 'sk-1234567890abcdef1234567890abcdef',
            },
          },
        ],
        connections: {
          'Manual Trigger': {
            main: [[{ node: 'OpenAI Call', type: 'main', index: 0 }]],
          },
        },
        settings: {},
        tags: [],
      };

      const res = validateAndRepairWorkflow(workflowWithSecret);
      expect(res.isValid).toBe(true);
      expect(res.credentialsNeeded).toHaveLength(1);
      expect(res.credentialsNeeded[0].placeholder).toBe('[YOUR_APIKEY]');
      expect(res.repairedWorkflow.nodes[1].parameters.apiKey).toBe('[YOUR_APIKEY]');
    });

    it('warns on unknown node types not in n8n-nodes-base whitelist', () => {
      const workflowWithCustomNode: N8nWorkflow = {
        name: 'Custom Node Workflow',
        active: false,
        nodes: [
          {
            id: 'node-1',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [250, 300],
            parameters: {},
          },
          {
            id: 'node-2',
            name: 'Unknown Tool',
            type: 'n8n-nodes-custom.someFancyService',
            typeVersion: 1,
            position: [470, 300],
            parameters: {},
          },
        ],
        connections: {
          Webhook: {
            main: [[{ node: 'Unknown Tool', type: 'main', index: 0 }]],
          },
        },
        settings: {},
        tags: [],
      };

      const res = validateAndRepairWorkflow(workflowWithCustomNode);
      expect(res.isValid).toBe(true);
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0].message).toContain('non-standard type');
    });
  });
});
