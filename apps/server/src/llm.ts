// Gemini LLM client for generating operations
import { GoogleGenAI } from "@google/genai";
import { Op, Doc, validateOps, getDocSummary, snapToGrid, ensureMinButtonHeight } from '@little-chef/dsl';

export class LLMClient {
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Google GenAI client
    // The client gets the API key from the environment variable `GEMINI_API_KEY`
    this.ai = new GoogleGenAI({});
  }

  async generateOps(doc: Doc, prompt: string, palette?: string[]): Promise<Op[]> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`[${requestId}] Starting LLM generation`, {
      docId: doc.id,
      docNodes: doc.nodes.length,
      promptLength: prompt.length,
      palette: palette?.length || 0
    });

    const systemPrompt = this.buildSystemPrompt(palette);
    const userPrompt = this.buildUserPrompt(doc, prompt);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    try {
      // Make request to Gemini API using GoogleGenAI
      console.log(`[${requestId}] Making request to Gemini API`, {
        promptLength: fullPrompt.length,
        model: 'gemini-2.5-flash-lite'
      });

      const apiStartTime = Date.now();
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: fullPrompt,
      });

      const apiDuration = Date.now() - apiStartTime;
      console.log(`[${requestId}] Gemini API response`, {
        duration: `${apiDuration}ms`
      });

      const text = response.text;

      if (!text) {
        console.error(`[${requestId}] No text content in Gemini response`);
        throw new Error('No text content in LLM response');
      }

      console.log(`[${requestId}] Received LLM response`, {
        textLength: text.length,
        textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      });

      // Parse JSON response - handle markdown code blocks
      let jsonResponse;
      try {
        // Remove markdown code blocks if present
        let cleanText = text.trim();
        const originalText = cleanText;

        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        jsonResponse = JSON.parse(cleanText);

        if (originalText !== cleanText) {
          console.log(`[${requestId}] Cleaned markdown formatting from response`);
        }
      } catch (parseError) {
        const error = parseError as Error;
        console.error(`[${requestId}] JSON parsing failed`, {
          error: error.message,
          textLength: text.length,
          textPreview: text.substring(0, 500),
          hasMarkdown: text.includes('```')
        });
        throw new Error(`Invalid JSON response from LLM: ${error.message}`);
      }

      // Validate operations
      console.log(`[${requestId}] Validating operations`, {
        operationCount: Array.isArray(jsonResponse) ? jsonResponse.length : 'not an array'
      });

      const ops = validateOps(jsonResponse);

      console.log(`[${requestId}] Operations validated successfully`, {
        operationCount: ops.length,
        operationTypes: ops.map(op => op.t)
      });

      // Apply constraints
      const constrainedOps = this.applyConstraints(ops);

      const totalDuration = Date.now() - startTime;
      console.log(`[${requestId}] LLM generation completed successfully`, {
        operationCount: constrainedOps.length,
        totalDuration: `${totalDuration}ms`,
        apiDuration: `${apiDuration}ms`
      });

      return constrainedOps;

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const err = error as Error;
      console.error(`[${requestId}] LLM generation failed`, {
        error: err.message,
        errorType: err.constructor.name,
        totalDuration: `${totalDuration}ms`,
        docId: doc.id,
        promptLength: prompt.length
      });

      // Re-throw with more context
      if (err.message.includes('Invalid JSON')) {
        throw error; // Keep original error for parsing issues
      } else {
        throw new Error(`LLM generation failed: ${err.message}`);
      }
    }
  }

  private buildSystemPrompt(palette?: string[]): string {
    let prompt = `You are Little Chef. You MUST output ONLY valid JSON - no markdown, no code blocks, no prose. Return a JSON array of operations that match this exact schema:

REQUIRED JSON SCHEMA:
[
  {
    "t": "add",
    "node": {
      "id": "string (unique identifier)",
      "type": "rect|text|button|image",
      "x": number (multiple of 8, ≥0),
      "y": number (multiple of 8, ≥0), 
      "width": number (multiple of 8, ≥1),
      "height": number (multiple of 8, ≥1, ≥44 for buttons),
      // Additional properties based on type:
      // rect: "fill": "#hexcolor", "stroke"?: "#hexcolor", "strokeWidth"?: number, "cornerRadius"?: number
      // text: "text": "string", "fontSize": number (8-72), "fontFamily": "string", "fontWeight": "string", "fill": "#hexcolor", "align": "left|center|right", "verticalAlign": "top|middle|bottom"
      // button: "label": "string", "fill": "#hexcolor", "stroke"?: "#hexcolor", "strokeWidth"?: number, "cornerRadius"?: number, "fontSize": number (8-72), "fontFamily": "string", "fontWeight": "string", "textFill": "#hexcolor"
      // image: "src": "url", "cornerRadius"?: number
    }
  },
  {
    "t": "update", 
    "id": "string (existing node id)",
    "patch": { /* partial node properties to update */ }
  },
  {
    "t": "remove",
    "id": "string (node id to delete)"
  },
  {
    "t": "reorder",
    "id": "string (node id)",
    "z": number (new z-order)
  }
]

EXAMPLE VALID RESPONSE:
[
  {
    "t": "add",
    "node": {
      "id": "btn1",
      "type": "button",
      "x": 16,
      "y": 24,
      "width": 120,
      "height": 48,
      "label": "Click Me",
      "fill": "#3b82f6",
      "cornerRadius": 8,
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": "500",
      "textFill": "#ffffff"
    }
  }
]

STRICT REQUIREMENTS:
- Output ONLY valid JSON array - no markdown, no code blocks, no explanations
- All coordinates must be multiples of 8
- Button height must be ≥44px
- Colors must be valid hex format (#rrggbb)
- Font sizes must be 8-72
- Keep total operations ≤10
- Use clean, modern design principles`;

    if (palette && palette.length > 0) {
      prompt += `\n\nAVAILABLE COLOR PALETTE: ${palette.join(', ')}`;
    }

    return prompt;
  }

  private buildUserPrompt(doc: Doc, userPrompt: string): string {
    const docSummary = getDocSummary(doc);
    const existingNodeIds = doc.nodes.map(n => n.id).join(', ');

    return `Current document: ${docSummary}
Existing node IDs: ${existingNodeIds || 'none'}

User request: ${userPrompt}

Generate operations that add or update nodes to fulfill this request. Focus on deltas (changes) rather than replacing the entire document. 

CRITICAL: Return ONLY a valid JSON array of operations - no markdown, no code blocks, no explanations. The response must be parseable JSON that matches the schema exactly.`;
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
