// Gemini LLM client for generating operations
import { GoogleAuth } from 'google-auth-library';
import { Op, Doc, validateOps, getDocSummary, snapToGrid, ensureMinButtonHeight } from '@little-chef/dsl';

export class LLMClient {
  private auth: GoogleAuth;
  private model: string;
  private endpoint: string;

  constructor(apiKey: string) {
    this.model = "gemini-1.5-flash";
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/generative-language"],
    });
  }

  async generateOps(doc: Doc, prompt: string, palette?: string[]): Promise<Op[]> {
    if (!this.auth) {
      throw new Error('LLM authentication not configured. Please set up Google Auth credentials.');
    }

    const systemPrompt = this.buildSystemPrompt(palette);
    const userPrompt = this.buildUserPrompt(doc, prompt);

    try {
      const client = await this.auth.getClient();

      const response = await client.request({
        url: this.endpoint,
        method: "POST",
        data: {
          contents: [{
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          }
        },
      });

      const text = (response.data as any).candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No text content in LLM response');
      }

      // Parse JSON response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse LLM JSON response:', parseError);
        throw new Error('Invalid JSON response from LLM');
      }

      // Validate operations
      const ops = validateOps(jsonResponse);

      // Apply constraints
      return this.applyConstraints(ops);

    } catch (error) {
      console.error('LLM generation error:', error);
      throw new Error('Failed to generate operations');
    }
  }

  private buildSystemPrompt(palette?: string[]): string {
    let prompt = `You are Little Chef. You output only JSON matching the provided schema: a small list of valid Ops for our DSL. Keep ≤10 nodes total, snap to 8px grid (positions multiples of 8), buttons ≥ 44px height, use provided palette if any. No prose.

Available node types:
- rect: rectangles with fill color, optional stroke and corner radius
- text: text blocks with font styling and alignment
- button: interactive buttons with labels and styling
- image: images with optional corner radius

Operation types:
- add: add a new node
- update: modify existing node properties
- remove: delete a node by id
- reorder: change node z-order (use y position for now)

Constraints:
- All positions must be multiples of 8 (snap to grid)
- Buttons must be at least 44px tall
- Keep total nodes ≤ 10
- Use clean, modern design principles`;

    if (palette && palette.length > 0) {
      prompt += `\n\nUse this color palette: ${palette.join(', ')}`;
    }

    return prompt;
  }

  private buildUserPrompt(doc: Doc, userPrompt: string): string {
    const docSummary = getDocSummary(doc);
    const existingNodeIds = doc.nodes.map(n => n.id).join(', ');

    return `Current document: ${docSummary}
Existing node IDs: ${existingNodeIds || 'none'}

User request: ${userPrompt}

Generate operations that add or update nodes to fulfill this request. Focus on deltas (changes) rather than replacing the entire document. Return only valid JSON array of operations.`;
  }

  private applyConstraints(ops: Op[]): Op[] {
    return ops.map(op => {
      if (op.t === 'add') {
        const node = { ...op.node };

        // Snap positions to grid
        node.x = snapToGrid(node.x);
        node.y = snapToGrid(node.y);
        node.width = snapToGrid(node.width);
        node.height = snapToGrid(node.height);

        // Ensure button minimum height
        if (node.type === 'button') {
          node.height = ensureMinButtonHeight(node.height);
        }

        return { ...op, node };
      }

      if (op.t === 'update' && op.patch) {
        const patch = { ...op.patch };

        // Snap position updates to grid
        if (typeof patch.x === 'number') patch.x = snapToGrid(patch.x);
        if (typeof patch.y === 'number') patch.y = snapToGrid(patch.y);
        if (typeof patch.width === 'number') patch.width = snapToGrid(patch.width);
        if (typeof patch.height === 'number') patch.height = snapToGrid(patch.height);

        // Ensure button minimum height
        if (patch.height && typeof patch.height === 'number') {
          patch.height = ensureMinButtonHeight(patch.height);
        }

        return { ...op, patch };
      }

      return op;
    });
  }
}
