# Connection Validation System

## Overview

This codebase implements a professional-grade connection validation system for ReactFlow nodes that prevents invalid connections and provides real-time visual feedback.

## Architecture

### Core Files

1. **`src/types/connection.types.ts`** - Type definitions and handle configurations
2. **`src/store/connection-validator.ts`** - Validation logic and rules
3. **`src/canvas/Canvas.tsx`** - Visual feedback integration
4. **`src/nodes/BaseNode.tsx`** - Handle rendering with validation states

### Key Features

- **Allow-list strategy**: Only explicitly permitted connections work
- **Semantic handle types**: `image`, `prompt`, `seed`, `video`, `mask`, `number`, etc.
- **Real-time visual feedback**: Handles change color during connection attempts
- **Comprehensive logging**: Blocked connections logged to console with reasons
- **Type-safe validation**: TypeScript interfaces for all validation data

## How It Works

### 1. Handle Type System

Each node has defined input and output handles with semantic types:

```typescript
type HandleType = 
  | 'image'      // Image data (URLs, base64)
  | 'prompt'     // Text prompts for LLM/gen models  
  | 'seed'       // Random seed values
  | 'video'      // Video data
  | 'mask'       // Mask/alpha channels
  | 'number'     // Numeric values
  | 'unknown'    // Default for generic connections
  // ... more types
```

### 2. Node Configuration

Node handle configurations are defined in `NODE_HANDLES`:

```typescript
NODE_HANDLES = {
  imageUpload: {
    inputs: [],  // No inputs
    outputs: [
      { id: 'image', type: 'image', label: 'Image', position: Position.Right }
    ]
  },
  seed: {
    inputs: [
      { id: 'input', type: 'unknown', label: 'Input', position: Position.Left }
    ],
    outputs: [
      { id: 'output', type: 'seed', label: 'Seed', position: Position.Right }
    ]
  }
}
```

### 3. Validation Rules

Connection rules are defined in `CONNECTION_VALIDATION_RULES`:

```typescript
CONNECTION_VALIDATION_RULES = {
  seed: {
    allowedInputs: ['unknown', 'number', 'text'], // Only these types
    blockedConnections: [
      { from: 'imageUpload', to: 'seed', reason: 'Image cannot connect to seed' }
    ]
  }
}
```

### 4. Validation Flow

1. User drags from source handle
2. `onConnectStart` sets `isConnecting = true`
3. Mouse move checks for valid targets
4. `isValidConnection()` validates on release
5. Invalid connections are **blocked** and logged
6. Valid connections proceed normally

## Visual Feedback

During connection attempts:

- **Valid target**: Handle turns light blue with glow effect
- **Invalid target**: Handle turns red
- **Default state**: Handle is cyan blue (`#0097A7`)

## Usage in Components

### BaseNode Component

BaseNode automatically reads handle definitions from `NODE_HANDLES` based on `data.type`:

```typescript
<BaseNode id={id} data={data}>
  {/* Node content */}
</BaseNode>
```

**Override handle definitions in node data:**

```typescript
<BaseNode 
  id={id} 
  data={{
    ...data,
    inputHandles: [{ id: 'custom', type: 'image', label: 'Custom' }],
    outputHandles: [{ id: 'out', type: 'prompt', label: 'Output' }]
  }}
>
```

### Custom Validation

Validation happens in two places:

1. **Canvas level** - `Canvas.tsx` has `isValidConnection` prop:
```typescript
<ReactFlow
  isValidConnection={(connection) => {
    const validation = isValidConnection(connection, nodes);
    return validation.valid; // true or false
  }}
/>
```

2. **Store level** - `useStore.ts` blocks invalid connections:
```typescript
onConnect: (connection: Connection) => {
  const validation = isValidConnection(connection, get().nodes);
  
  if (!validation.valid) {
    console.warn(`Blocked: ${validation.message}`);
    return; // ❌ BLOCKED
  }
  
  set({ edges: addEdge(connection, get().edges) });
}
```

## Adding Validation to New Nodes

When creating new nodes, you have three options:

### Option 1: Default Fallback (Easiest)

If node type not in `NODE_HANDLES`, BaseNode uses defaults:

```typescript
<BaseNode id={id} data={data}>
  {/* Gets default single input/output with 'unknown' type */}
</BaseNode>
```

### Option 2: Add to NODE_HANDLES Configuration

Edit `src/types/connection.types.ts` and add your node:

```typescript
NODE_HANDLES = {
  // ... existing nodes
  myNewNode: {
    inputs: [
      { id: 'input1', type: 'image', label: 'Image', position: Position.Left }
    ],
    outputs: [
      { id: 'output1', type: 'mask', label: 'Mask', position: Position.Right }
    ]
  }
}
```

### Option 3: Inline Handle Definitions

Pass handles directly in data prop:

```typescript
const MyNode = ({ id, data }) => (
  <BaseNode 
    id={id} 
    data={{
      ...data,
      inputHandles: [{ id: 'in', type: 'image', label: 'Image' }],
      outputHandles: [{ id: 'out', type: 'mask', label: 'Mask' }]
    }}
  >
    {/* content */}
  </BaseNode>
);
```

## Testing Validation

### Test in Browser Console

```javascript
// Enable verbose logging
localStorage.setItem('debug_connection', 'true');

// Try connecting nodes
// Blocked connections will log to console with reasons
```

### Common Validation Errors

1. **"Type mismatch: image → seed"** - Source and target types don't match
2. **"Cannot connect node to itself"** - Self-connections blocked
3. **"Source or target node not found"** - Node ID issue
4. **"[nodeType] cannot accept [type] type"** - Explicit type rejection

## Migration Guide

### For Existing Nodes

Most nodes already work automatically with the fallback. To add proper validation:

1. Identify node type from `data.type`
2. Add configuration to `NODE_HANDLES` if specific input/output types needed
3. Add validation rules to `CONNECTION_VALIDATION_RULES` if special restrictions needed

### Blocked Connection Examples

These connections are explicitly blocked:
- `imageUpload` → `seed` (Image cannot connect to seed)
- `videoUpload` → `seed` (Video cannot connect to seed)
- `imagen` → `seed` (Prevent feedback loops)
- `veo` → `seed` (Prevent feedback loops)

## Best Practices

1. **Use semantic types**: Choose `image`, `prompt`, `video` over `unknown` when possible
2. **Define explicit rules**: Use `allowedInputs` instead of relying on defaults
3. **Test edge cases**: Verify validation works for complex node graphs
4. **Document exceptions**: Comment why certain connections are blocked

## Troubleshooting

### Debug Mode

Enable debug logging:

```typescript
// In connection-validator.ts
const DEBUG_MODE = true; // Set to true for console logging
```

### Common Issues

**Visual feedback not showing:**
- Check BaseNode receives `isConnecting` prop
- Verify handle has proper classNames for validation states

**Connections not blocked:**
- Ensure `isValidConnection` callback passed to ReactFlow
- Check store's `onConnect` has validation logic

**Handle labels not showing:**
- Verify handle has `label` property
- Check CSS for positioning

## Performance

Validation is optimized for real-time feedback:
- O(n) where n = number of nodes (linear scan)
- No database queries or external API calls
- Memoized ReactFlow components prevent unnecessary re-renders
- Visual feedback uses CSS classes (fast) vs inline styles

## Extensibility

To add new handle types:

1. Add type to `HandleType` union in `connection.types.ts`
2. Add color mapping in `BaseNode.tsx` if needed
3. Update validation rules to recognize new type
4. Add to documentation

## Support

For questions or issues with the connection validation system, check:
- Console logs for validation messages
- `NODE_HANDLES` configuration
- `CONNECTION_VALIDATION_RULES` for blocked pairs
- ReactFlow documentation for handle positioning

## Handle Positioning Fix (Empty Nodes Issue)

### Problem
When nodes were empty (no output content), connection lines didn't snap to handle dots correctly. This was caused by ReactFlow caching node dimensions during the initial render/animation, before content was fully laid out.

### Solution (BaseNode.tsx)
1. **`useUpdateNodeInternals()`** - ReactFlow hook to force re-measurement of handle positions
2. **`ResizeObserver`** - Detects when node dimensions change (empty → has content)
3. **`useLayoutEffect` + `requestAnimationFrame`** - Forces re-measurement right after initial render
4. **`onAnimationComplete`** - Triggers re-measurement after motion.div animation finishes

```typescript
const updateNodeInternals = useUpdateNodeInternals();
const nodeRef = useRef<HTMLDivElement>(null);

// Re-measure after initial render
useIsomorphicLayoutEffect(() => {
  const timer = requestAnimationFrame(() => {
    updateNodeInternals(id);
  });
  return () => cancelAnimationFrame(timer);
}, [id, updateNodeInternals]);

// Re-measure when node resizes
useEffect(() => {
  const node = nodeRef.current;
  if (!node) return;
  
  const observer = new ResizeObserver(() => {
    updateNodeInternals(id);
  });
  observer.observe(node);
  
  return () => observer.disconnect();
}, [id, updateNodeInternals]);
```

This ensures handles are always positioned correctly regardless of node content state.
