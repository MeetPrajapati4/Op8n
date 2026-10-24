import { z } from 'zod';
import { N8nWorkflow, N8nNode } from './n8n-types';

/**
 * Known n8n node types whitelist for n8n-nodes-base
 */
export const KNOWN_N8N_NODES = new Set([
  // Triggers
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.intervalTrigger',
  'n8n-nodes-base.formTrigger',
  'n8n-nodes-base.chatTrigger',
  'n8n-nodes-base.emailReadImap',
  'n8n-nodes-base.githubTrigger',
  'n8n-nodes-base.slackTrigger',
  'n8n-nodes-base.telegramTrigger',
  // Common Connectors / Actions
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.gmail',
  'n8n-nodes-base.emailSend',
  'n8n-nodes-base.slack',
  'n8n-nodes-base.telegram',
  'n8n-nodes-base.notion',
  'n8n-nodes-base.googleSheets',
  'n8n-nodes-base.airtable',
  'n8n-nodes-base.openAi',
  'n8n-nodes-base.awsS3',
  'n8n-nodes-base.postgres',
  'n8n-nodes-base.mySql',
  'n8n-nodes-base.mongoDb',
  'n8n-nodes-base.redis',
  'n8n-nodes-base.discord',
  'n8n-nodes-base.github',
  'n8n-nodes-base.stripe',
  'n8n-nodes-base.hubspot',
  'n8n-nodes-base.jira',
  'n8n-nodes-base.sendGrid',
  'n8n-nodes-base.twilio',
  'n8n-nodes-base.crypto',
  'n8n-nodes-base.ssh',
  // Core logic / flow
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.code',
  'n8n-nodes-base.set',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.dateTime',
  'n8n-nodes-base.function',
  'n8n-nodes-base.executeWorkflow',
  'n8n-nodes-base.respondToWebhook',
  'n8n-nodes-base.stopAndError',
  'n8n-nodes-base.filter',
  'n8n-nodes-base.sort',
  'n8n-nodes-base.aggregate',
  'n8n-nodes-base.editFields',
]);

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  node?: string;
  field?: string;
}

export interface CredentialRequirement {
  node: string;
  field: string;
  placeholder: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  credentialsNeeded: CredentialRequirement[];
  repairedWorkflow: N8nWorkflow;
}

// Zod schemas
export const n8nNodeSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  name: z.string().min(1, 'Node name is required'),
  type: z.string().min(1, 'Node type is required'),
  typeVersion: z.number().default(1),
  position: z.array(z.number()).length(2, 'Position must be a [x, y] coordinate').or(z.tuple([z.number(), z.number()])),
  parameters: z.record(z.string(), z.unknown()).default({}),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
}).passthrough();

export const n8nConnectionItemSchema = z.object({
  node: z.string().min(1, 'Target node name is required'),
  type: z.string().default('main'),
  index: z.number().default(0),
}).passthrough();

export const n8nConnectionsSchema = z.record(
  z.string(),
  z.object({
    main: z.array(z.array(n8nConnectionItemSchema)).optional(),
  }).passthrough()
).default({});

export const n8nWorkflowBaseSchema = z.object({
  name: z.string().default('Op8n Workflow'),
  nodes: z.array(n8nNodeSchema).min(1, 'Workflow must contain at least one node'),
  connections: n8nConnectionsSchema,
  active: z.boolean().default(false),
  settings: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
}).passthrough();

/**
 * Check if a node is an n8n trigger
 */
export function isTriggerNode(node: { type: string; name?: string }): boolean {
  const type = node.type.toLowerCase();
  return (
    type.includes('trigger') ||
    type === 'n8n-nodes-base.webhook' ||
    type === 'n8n-nodes-base.manualtrigger'
  );
}

/**
 * Auto-fix missing or duplicate positions with a left-to-right layout
 */
export function autoLayoutPositions(nodes: N8nNode[], connections: Record<string, { main?: Array<Array<{ node: string }>> }> = {}): N8nNode[] {
  const positionsSeen = new Set<string>();
  let needsLayout = false;

  for (const node of nodes) {
    if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
      needsLayout = true;
      break;
    }
    const [x, y] = node.position;
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      needsLayout = true;
      break;
    }
    const key = `${x},${y}`;
    if (positionsSeen.has(key)) {
      needsLayout = true; // Duplicate position found
      break;
    }
    positionsSeen.add(key);
  }

  if (!needsLayout) {
    return nodes;
  }

  // Generate left-to-right position layout
  // 1. Find trigger or starting node
  const triggerIndex = nodes.findIndex(isTriggerNode);
  const orderedNodes: N8nNode[] = [];
  const visited = new Set<string>();

  if (triggerIndex !== -1) {
    const trigger = nodes[triggerIndex];
    orderedNodes.push(trigger);
    visited.add(trigger.name);

    // BFS through connections
    const queue = [trigger.name];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoing = connections[current]?.main?.flat() ?? [];
      for (const conn of outgoing) {
        if (!visited.has(conn.node)) {
          const targetNode = nodes.find((n) => n.name === conn.node);
          if (targetNode) {
            visited.add(conn.node);
            orderedNodes.push(targetNode);
            queue.push(conn.node);
          }
        }
      }
    }
  }

  // Add any unvisited or disconnected nodes
  for (const node of nodes) {
    if (!visited.has(node.name)) {
      orderedNodes.push(node);
      visited.add(node.name);
    }
  }

  // Assign left-to-right positions starting at [250, 300], x += 220
  return orderedNodes.map((node, index) => ({
    ...node,
    position: [250 + index * 220, 300] as [number, number],
  }));
}

/**
 * Recursively check and sanitize secrets/credentials from parameters
 */
export function sanitizeParameters(
  params: Record<string, unknown>,
  nodeName: string
): { cleaned: Record<string, unknown>; credentialsNeeded: CredentialRequirement[] } {
  const credentialsNeeded: CredentialRequirement[] = [];

  function sanitize(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // Check for real secrets or tokens
      const isSensitiveKey = /(api[_-]?key|bearer|token|secret|password|private[_-]?key|auth)/i.test(path);
      const isActualSecretPattern = /(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9]{10,}|Bearer\s+[a-zA-Z0-9_\-\.]{15,})/i.test(obj);

      if (isSensitiveKey || isActualSecretPattern) {
        if (!obj.startsWith('{{') && !obj.startsWith('=')) {
          const fieldName = path.split('.').pop() || 'secret';
          const placeholder = `[YOUR_${fieldName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}]`;
          credentialsNeeded.push({
            node: nodeName,
            field: path,
            placeholder,
          });
          return placeholder;
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, idx) => sanitize(item, `${path}[${idx}]`));
    }

    if (typeof obj === 'object') {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        res[k] = sanitize(v, path ? `${path}.${k}` : k);
      }
      return res;
    }

    return obj;
  }

  const cleaned = sanitize(params, '') as Record<string, unknown>;
  return { cleaned, credentialsNeeded };
}

/**
 * Validate and auto-repair an n8n workflow JSON object
 */
export function validateAndRepairWorkflow(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const credentialsNeeded: CredentialRequirement[] = [];

  // 1. Zod Base Parse
  const parseResult = n8nWorkflowBaseSchema.safeParse(input);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        type: 'error',
        message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
        field: issue.path.join('.'),
      });
    }

    // Return failure with fallback structure
    return {
      isValid: false,
      errors,
      warnings,
      credentialsNeeded,
      repairedWorkflow: (input as N8nWorkflow) || {
        name: 'Invalid Workflow',
        nodes: [],
        connections: {},
        active: false,
        settings: {},
        tags: [],
      },
    };
  }

  const rawWorkflow = parseResult.data;

  // 2. Node Name Uniqueness
  const nodeNames = new Set<string>();
  for (const node of rawWorkflow.nodes) {
    if (nodeNames.has(node.name)) {
      errors.push({
        type: 'error',
        node: node.name,
        message: `Duplicate node name: "${node.name}". Every node must have a distinct name.`,
      });
    }
    nodeNames.add(node.name);
  }

  // 3. Exactly One Trigger Node
  const triggers = rawWorkflow.nodes.filter(isTriggerNode);
  if (triggers.length === 0) {
    errors.push({
      type: 'error',
      message: 'Workflow must have exactly one trigger node (found 0). Add a manualTrigger, webhook, or scheduleTrigger.',
    });
  } else if (triggers.length > 1) {
    errors.push({
      type: 'error',
      message: `Workflow must have exactly one trigger node (found ${triggers.length}: ${triggers.map((t) => `"${t.name}"`).join(', ')}).`,
    });
  }

  // 4. Connection Targets & Sources Validity
  for (const [sourceName, connGroup] of Object.entries(rawWorkflow.connections || {})) {
    if (!nodeNames.has(sourceName)) {
      errors.push({
        type: 'error',
        node: sourceName,
        message: `Connection source "${sourceName}" is not in the nodes list.`,
      });
    }

    if (connGroup?.main) {
      for (const branch of connGroup.main) {
        for (const conn of branch) {
          if (!nodeNames.has(conn.node)) {
            errors.push({
              type: 'error',
              node: sourceName,
              message: `Connection from "${sourceName}" points to unknown node "${conn.node}".`,
            });
          }
        }
      }
    }
  }

  // 5. Node Whitelist Warnings & Secrets Sanitization
  const cleanedNodes: N8nNode[] = [];
  for (const node of rawWorkflow.nodes) {
    // Check type whitelist
    if (!KNOWN_N8N_NODES.has(node.type)) {
      warnings.push({
        type: 'warning',
        node: node.name,
        message: `Node "${node.name}" uses non-standard type "${node.type}". It may require a custom n8n community node.`,
      });
    }

    // Sanitize parameters for secrets
    const { cleaned: sanitizedParams, credentialsNeeded: nodeCreds } = sanitizeParameters(
      (node.parameters || {}) as Record<string, unknown>,
      node.name
    );
    credentialsNeeded.push(...nodeCreds);

    cleanedNodes.push({
      ...node,
      position: node.position as [number, number],
      parameters: sanitizedParams,
    });
  }

  // 6. Auto-Repair Layout Positions
  const layoutedNodes = autoLayoutPositions(cleanedNodes, rawWorkflow.connections as Record<string, { main?: Array<Array<{ node: string }>> }>);

  const repairedWorkflow: N8nWorkflow = {
    name: rawWorkflow.name || 'Op8n Workflow',
    nodes: layoutedNodes,
    connections: (rawWorkflow.connections || {}) as Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>,
    active: rawWorkflow.active ?? false,
    settings: rawWorkflow.settings || {},
    tags: rawWorkflow.tags || [],
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    credentialsNeeded,
    repairedWorkflow,
  };
}
