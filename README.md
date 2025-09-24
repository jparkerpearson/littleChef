# Little Chef

A collaborative design tool powered by AI. Describe what you want to create, and Little Chef will bring it to life using Google Gemini's structured output capabilities.

## Architecture

Little Chef is built as a monorepo with three main packages:

- **`packages/dsl`** - Shared TypeScript types and Zod schemas for the document DSL
- **`apps/server`** - Fastify API server with WebSocket support and Gemini integration
- **`apps/web`** - Next.js frontend with React-Konva canvas editor

### Key Features

- **AI-Powered Generation**: Uses Google Gemini 1.5 with structured JSON output
- **Real-time Collaboration**: WebSocket-based live editing
- **Canvas Editor**: React-Konva powered visual editor with drag, resize, and selection
- **Type Safety**: Full TypeScript with Zod validation throughout
- **Operation Log**: Immutable operation-based state management

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn 4.0+
- Google Gemini API key

### Installation

```bash
# Install dependencies
yarn install

# Copy environment template
cp apps/server/env.example apps/server/.env
```

### Environment Setup

Edit `apps/server/.env`:

```env
PORT=4000
GOOGLE_API_KEY=your_gemini_api_key_here
```

### Development

```bash
# Start both server and web app
yarn dev

# Or start individually
yarn workspace @little-chef/server dev
yarn workspace @little-chef/web dev
```

- Server: http://localhost:4000
- Web App: http://localhost:3000

### Production Build

```bash
yarn build
```

## API Documentation

### REST Endpoints

#### `POST /v1/doc`
Create a new document.

**Request:**
```json
{
  "width": 800,
  "height": 600,
  "title": "My Document"
}
```

**Response:**
```json
{
  "doc": {
    "id": "abc123",
    "width": 800,
    "height": 600,
    "nodes": [],
    "version": 0,
    "schemaVersion": 1,
    "title": "My Document",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### `GET /v1/doc/:id`
Get document with operations since a version.

**Query Parameters:**
- `since` (optional): Version number to get operations since

**Response:**
```json
{
  "snapshot": { /* Doc object */ },
  "opsSince": [ /* Op[] array */ ],
  "version": 5
}
```

#### `POST /v1/ops`
Append operations to a document.

**Request:**
```json
{
  "docId": "abc123",
  "ops": [
    {
      "t": "add",
      "node": {
        "id": "node1",
        "type": "rect",
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 100,
        "fill": "#ff0000"
      }
    }
  ]
}
```

#### `POST /v1/generate`
Generate operations using AI.

**Request:**
```json
{
  "docId": "abc123",
  "prompt": "Add a blue button with 'Click Me' text",
  "palette": ["#0000ff", "#ffffff"]
}
```

**Response:**
```json
{
  "ops": [ /* Generated Op[] array */ ],
  "version": 6
}
```

### WebSocket Endpoint

#### `GET /v1/sync?docId=:id`

Connects to real-time collaboration for a document.

**Messages:**

- `hello`: Initial connection with current document state
- `ops`: New operations from other collaborators

## DSL Specification

### Document Structure

```typescript
interface Doc {
  id: string;
  width: number;
  height: number;
  nodes: Node[];
  version: number;
  schemaVersion: number;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Node Types

#### Rectangle Node
```typescript
interface RectNode {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string; // Hex color
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}
```

#### Text Node
```typescript
interface TextNode {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
}
```

#### Button Node
```typescript
interface ButtonNode {
  id: string;
  type: 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textFill: string;
}
```

#### Image Node
```typescript
interface ImageNode {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  cornerRadius?: number;
}
```

### Operations

```typescript
type Op =
  | { t: 'add'; node: Node }
  | { t: 'update'; id: string; patch: Partial<Node> }
  | { t: 'remove'; id: string }
  | { t: 'reorder'; id: string; z: number };
```

## Development

### Project Structure

```
littleChef/
├── packages/
│   └── dsl/                 # Shared types and schemas
├── apps/
│   ├── server/              # Fastify API server
│   └── web/                 # Next.js frontend
├── package.json             # Root workspace config
└── README.md
```

### Adding New Node Types

1. Add the type definition to `packages/dsl/src/types.ts`
2. Add Zod schema to `packages/dsl/src/schemas.ts`
3. Update the discriminated union in `NodeSchema`
4. Add renderer in `apps/web/src/components/Canvas.tsx`
5. Add inspector controls in `apps/web/src/components/Inspector.tsx`

### Extending the API

1. Add route handler in `apps/server/src/routes.ts`
2. Add TypeScript types in `apps/server/src/types.ts`
3. Update API client in `apps/web/src/lib/api.ts`

### Database Migration

The current implementation uses in-memory storage. To migrate to PostgreSQL:

1. Replace `Store` class in `apps/server/src/store.ts`
2. Add database connection and ORM (Prisma recommended)
3. Update operation persistence logic
4. Add database migrations for schema changes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.