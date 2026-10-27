export interface SampleSnippet {
  id: string;
  name: string;
  language: string;
  code: string;
  expectedRisk: string;
}

export const SAMPLE_SNIPPETS: SampleSnippet[] = [
  {
    id: 'sql-injection',
    name: 'SQL Injection Vulnerability',
    language: 'typescript',
    expectedRisk: 'high',
    code: `import { Request, Response } from 'express';
import { db } from './database';

export async function getUserProfile(req: Request, res: Response) {
  const userId = req.query.id;

  // UNSAFE: Direct string interpolation into raw SQL query
  const query = \`SELECT id, username, email, role, password_hash FROM users WHERE id = '\${userId}'\`;
  
  try {
    const result = await db.raw(query);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    // SENSITIVE DATA EXPOSURE: Returning raw password_hash
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}`,
  },
  {
    id: 'command-injection',
    name: 'Remote Command Execution (Python)',
    language: 'python',
    expectedRisk: 'high',
    code: `import os
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/ping", methods=["GET"])
def ping_host():
    target_ip = request.args.get("ip", "")
    
    # CRITICAL: Untrusted input directly passed to shell execution
    command = f"ping -c 3 {target_ip}"
    output = subprocess.check_output(command, shell=True)
    
    return jsonify({"status": "ok", "output": output.decode("utf-8")})`,
  },
  {
    id: 'memory-leak',
    name: 'Event Listener Memory Leak (JavaScript)',
    language: 'javascript',
    expectedRisk: 'medium',
    code: `const EventEmitter = require('events');
const eventBus = new EventEmitter();

function registerClientSession(clientId) {
  const sessionBuffer = Buffer.alloc(1024 * 1024 * 10); // 10 MB per session
  
  // LEAK: Listener retains sessionBuffer in closure scope indefinitely
  eventBus.on('broadcast', (message) => {
    console.log(\`Client \${clientId} received message: \${message.length} bytes\`);
    if (sessionBuffer) {
      sessionBuffer.write(message);
    }
  });
  
  return { clientId, registered: true };
}`,
  },
  {
    id: 'clean-code',
    name: 'Clean & Secure Handler (TypeScript)',
    language: 'typescript',
    expectedRisk: 'none',
    code: `import { z } from 'zod';
import { db } from './db';

const UserIdSchema = z.string().uuid({ message: 'Invalid UUID format' });

export async function getSanitizedUser(rawId: unknown) {
  const parseResult = UserIdSchema.safeParse(rawId);
  if (!parseResult.success) {
    throw new Error('Invalid user ID provided');
  }

  // SAFE: Parameterized query prevents injection
  const user = await db.user.findUnique({
    where: { id: parseResult.data },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
    },
  });

  return user;
}`,
  },
];
