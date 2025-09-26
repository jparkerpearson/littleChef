// Gemini LLM client for generating operations
import { GoogleGenAI } from "@google/genai";
import { Op, Doc, Node, validateOps, getDocSummary, snapToGrid, ensureMinButtonHeight } from '@little-chef/dsl';

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

      const ops = validateOps(jsonResponse) as Op[];

      console.log(`[${requestId}] Operations validated successfully`, {
        operationCount: ops.length,
        operationTypes: ops.map(op => op.t)
      });

      // Apply constraints
      const constrainedOps = this.applyConstraints(ops);

      // Log tree representation of the resulting document
      this.logDocumentTree(requestId, doc, constrainedOps);

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
    let prompt = `You are Little Chef, an expert web designer. You MUST output ONLY valid JSON - no markdown, no code blocks, no prose. Return a JSON array of operations that create realistic, complex website layouts with proper hierarchy and many nodes.

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
      "parentId": "string (optional, omit for root nodes - NEVER use null)",
      "children": ["string"] (optional, array of child node IDs),
      // Additional properties based on type:
      // rect: "fill": "color", "stroke"?: "color", "strokeWidth"?: number, "cornerRadius"?: number
      // text: "text": "string", "fontSize": number (8-72), "fontFamily": "string", "fontWeight": "string", "fill": "color", "align": "left|center|right", "verticalAlign": "top|middle|bottom"
      // button: "label": "string", "fill": "color", "stroke"?: "color", "strokeWidth"?: number, "cornerRadius"?: number, "fontSize": number (8-72), "fontFamily": "string", "fontWeight": "string", "textFill": "color"
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
  },
  {
    "t": "reparent",
    "id": "string (node id)",
    "parentId": "string (new parent id, omit for root)"
  },
  {
    "t": "addChild",
    "parentId": "string (parent node id)",
    "childId": "string (child node id)"
  }
]

COMPLEX WEBSITE EXAMPLE (Realistic Layout):
[
  {
    "t": "add",
    "node": {
      "id": "header",
      "type": "rect",
      "x": 0,
      "y": 0,
      "width": 1200,
      "height": 80,
      "fill": "#ffffff",
      "stroke": "#e5e7eb",
      "strokeWidth": 1
    }
  },
  {
    "t": "add",
    "node": {
      "id": "logo",
      "type": "text",
      "x": 24,
      "y": 24,
      "width": 200,
      "height": 32,
      "text": "BrandName",
      "fontSize": 24,
      "fontFamily": "Inter",
      "fontWeight": "700",
      "fill": "#1f2937",
      "align": "left",
      "verticalAlign": "middle",
      "parentId": "header"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "nav-menu",
      "type": "rect",
      "x": 400,
      "y": 16,
      "width": 600,
      "height": 48,
      "fill": "transparent",
      "parentId": "header"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "nav-home",
      "type": "button",
      "x": 0,
      "y": 0,
      "width": 80,
      "height": 48,
      "label": "Home",
      "fill": "transparent",
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": "500",
      "textFill": "#374151",
      "parentId": "nav-menu"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "nav-about",
      "type": "button",
      "x": 100,
      "y": 0,
      "width": 80,
      "height": 48,
      "label": "About",
      "fill": "transparent",
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": "500",
      "textFill": "#374151",
      "parentId": "nav-menu"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "nav-contact",
      "type": "button",
      "x": 200,
      "y": 0,
      "width": 100,
      "height": 48,
      "label": "Contact",
      "fill": "transparent",
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": "500",
      "textFill": "#374151",
      "parentId": "nav-menu"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "cta-button",
      "type": "button",
      "x": 1000,
      "y": 16,
      "width": 120,
      "height": 48,
      "label": "Get Started",
      "fill": "#3b82f6",
      "cornerRadius": 8,
      "fontSize": 16,
      "fontFamily": "Inter",
      "fontWeight": "600",
      "textFill": "#ffffff",
      "parentId": "header"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "hero-section",
      "type": "rect",
      "x": 0,
      "y": 80,
      "width": 1200,
      "height": 400,
      "fill": "#f8fafc"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "hero-title",
      "type": "text",
      "x": 100,
      "y": 120,
      "width": 600,
      "height": 80,
      "text": "Build Amazing Websites",
      "fontSize": 48,
      "fontFamily": "Inter",
      "fontWeight": "800",
      "fill": "#1f2937",
      "align": "left",
      "verticalAlign": "top",
      "parentId": "hero-section"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "hero-subtitle",
      "type": "text",
      "x": 100,
      "y": 220,
      "width": 500,
      "height": 60,
      "text": "Create beautiful, responsive websites with our intuitive design tools",
      "fontSize": 20,
      "fontFamily": "Inter",
      "fontWeight": "400",
      "fill": "#6b7280",
      "align": "left",
      "verticalAlign": "top",
      "parentId": "hero-section"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "hero-cta",
      "type": "button",
      "x": 100,
      "y": 300,
      "width": 160,
      "height": 56,
      "label": "Start Building",
      "fill": "#10b981",
      "cornerRadius": 12,
      "fontSize": 18,
      "fontFamily": "Inter",
      "fontWeight": "600",
      "textFill": "#ffffff",
      "parentId": "hero-section"
    }
  },
  {
    "t": "add",
    "node": {
      "id": "hero-image",
      "type": "image",
      "x": 700,
      "y": 100,
      "width": 400,
      "height": 300,
      "src": "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
      "cornerRadius": 16,
      "parentId": "hero-section"
    }
  }
]

DESIGN PRINCIPLES FOR COMPLEX LAYOUTS:
- Create realistic website structures with header, hero, content sections, and footer
- Use hierarchical grouping (parentId/children) to organize related elements
- Include navigation menus with multiple items
- Add hero sections with titles, subtitles, and call-to-action buttons
- Create content grids with multiple cards or feature sections
- Include proper spacing and alignment (16px, 24px, 32px, 48px spacing)
- Use consistent color schemes and typography
- Add realistic content like "About Us", "Services", "Contact" sections
- Include multiple interactive elements (buttons, links, forms)

STRICT REQUIREMENTS:
- Output ONLY valid JSON array - no markdown, no code blocks, no explanations
- All coordinates must be multiples of 8
- Button height must be ≥44px
- Colors must be EXACTLY: hex format (#rrggbb), "transparent", or these CSS names: white, black, red, green, blue, yellow, orange, purple, pink, gray, grey
- Font sizes must be 8-72
- Create 15-25+ nodes for realistic website layouts
- Use hierarchical grouping extensively with parentId and children
- OMIT parentId property entirely for root-level nodes (never use null)
- Focus on complete, functional website sections rather than isolated elements
- Use modern web design patterns and realistic content
- Only include properties that are actually used by the frontend rendering system`;

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

Generate operations that create a complete, realistic website layout. When creating mock websites, include:
- Full header with logo, navigation menu, and CTA button
- Hero section with compelling title, subtitle, and action buttons
- Multiple content sections (features, about, services, etc.)
- Proper hierarchical grouping using parentId and children
- 15-25+ nodes for realistic complexity
- Consistent spacing, colors, and typography
- Multiple interactive elements and realistic content

Focus on creating complete website sections rather than isolated elements. Use hierarchical grouping extensively to organize related components.

CRITICAL: Return ONLY a valid JSON array of operations - no markdown, no code blocks, no explanations. The response must be parseable JSON that matches the schema exactly.

COLOR REQUIREMENTS: Use ONLY hex colors (#rrggbb), "transparent", or these CSS names: white, black, red, green, blue, yellow, orange, purple, pink, gray, grey

PARENTID REQUIREMENTS: OMIT the parentId property entirely for root-level nodes. NEVER use null for parentId.`;
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

        return { ...op, node } as Op;
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

        return { ...op, patch } as Op;
      }

      return op as Op;
    });
  }

  private logDocumentTree(requestId: string, originalDoc: Doc, ops: Op[]): void {
    try {
      // Simulate applying operations to get the resulting document structure
      const nodeMap = new Map(originalDoc.nodes.map(node => [node.id, { ...node }]));

      // Apply operations to simulate the final state
      for (const op of ops) {
        if (op.t === 'add') {
          nodeMap.set(op.node.id, { ...op.node });
        } else if (op.t === 'update') {
          const existing = nodeMap.get(op.id);
          if (existing) {
            nodeMap.set(op.id, { ...existing, ...op.patch });
          }
        } else if (op.t === 'remove') {
          nodeMap.delete(op.id);
        } else if (op.t === 'reparent') {
          const existing = nodeMap.get(op.id);
          if (existing) {
            nodeMap.set(op.id, { ...existing, parentId: op.parentId === null ? undefined : op.parentId });
          }
        }
      }

      const allNodes = Array.from(nodeMap.values());

      // Build tree structure
      const rootNodes = allNodes.filter(node => !node.parentId);
      const treeLines: string[] = [];

      const buildTree = (nodes: Node[], depth: number = 0, prefix: string = '') => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const isLast = i === nodes.length - 1;
          const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');

          // Create node description
          let nodeDesc = `${node.type}(${node.id})`;
          if (node.type === 'text' && 'text' in node) {
            nodeDesc += `: "${node.text.substring(0, 30)}${node.text.length > 30 ? '...' : ''}"`;
          } else if (node.type === 'button' && 'label' in node) {
            nodeDesc += `: "${node.label}"`;
          } else if (node.type === 'image' && 'src' in node) {
            nodeDesc += `: ${node.src.split('/').pop() || 'image'}`;
          }

          nodeDesc += ` [${node.x},${node.y}] ${node.width}x${node.height}`;

          treeLines.push(currentPrefix + nodeDesc);

          // Find children
          const children = allNodes.filter(child => child.parentId === node.id);
          if (children.length > 0) {
            buildTree(children, depth + 1, nextPrefix);
          }
        }
      };

      buildTree(rootNodes);

      console.log(`[${requestId}] Document Tree Structure:`);
      console.log(`[${requestId}] ${'─'.repeat(50)}`);
      if (treeLines.length === 0) {
        console.log(`[${requestId}] (empty document)`);
      } else {
        treeLines.forEach(line => console.log(`[${requestId}] ${line}`));
      }
      console.log(`[${requestId}] ${'─'.repeat(50)}`);
      console.log(`[${requestId}] Total nodes: ${allNodes.length} (${rootNodes.length} root, ${allNodes.length - rootNodes.length} children)`);

    } catch (error) {
      console.error(`[${requestId}] Failed to log document tree:`, error);
    }
  }
}
