# NODE_HANDLES COMPREHENSIVE AUDIT & CORRECTION REPORT

**Date**: 2026-04-14  
**Status**: SYSTEMATIC AUDIT REQUIRED  
**Priority**: CRITICAL - BREAKING BUGS IN PRODUCTION

## 🚨 CRITICAL FINDINGS

### **Root Cause of Connection Problems**

**NODE_HANDLES is INCOMPLETE** - Contains only subset of actual handles used in node files. Nodes have **43 inline handles** defined but NODE_HANDLES registry doesn't match them.

---

## 📊 COMPREHENSIVE HANDLE INVENTORY

### **From Node File Analysis (43 inline handles)**

#### **1. VeoNode.tsx** - 7 handles
| Handle ID | Type | Side | Status |
|-----------|------|------|--------|
| prompt | target | Left | ✅ IN NODE_HANDLES |
| startFrame | target | Left | ❌ **MISSING** |
| endFrame | target | Left | ❌ **MISSING** |
| reference | target | Left | ❌ type mismatch (should be 'image') |
| video | target | Left | ❌ **MISSING** |
| motion | target | Left | ❌ **MISSING** |
| seed | target | Left | ✅ IN NODE_HANDLES |

**NODE_HANDLES.veo** currently only has: `['prompt', 'seed', 'image']`  
**Missing**: `startFrame`, `endFrame`, `video`, `motion`  
**Wrong**: `reference` should be `image` type

---

#### **2. ImagenNode.tsx** - 5 handles
| Handle ID | Type | Side | Status |
|-----------|------|------|--------|
| prompt | target | Left | ✅ IN NODE_HANDLES |
| reference | target | Left | ❌ type mismatch (should be 'image') |
| seed | target | Left | ✅ IN NODE_HANDLES |
| guidance | target | Left | ❌ **MISSING** |
| cfg | target | Left | ❌ **MISSING** |

**NODE_HANDLES.imagen** currently only has: `['prompt', 'seed', 'image']`  
**Missing**: `guidance`, `cfg`  
**Wrong**: `reference` should be `image` type

---

#### **3. LLMNode.tsx** - 2 handles
| Handle ID | Type | Side | Status |
|-----------|------|------|--------|
| text | target | Left | ❌ **MISSING type 'text'** |
| image | target | Left | ❌ **MISSING type 'image'** |

**NODE_HANDLES.llm** currently has: `['prompt', 'seed']` with `outputs: ['text']`  
**Wrong**: Should accept `text` and `image` inputs, not prompt/seed

---

#### **4. LyriaNode.tsx** - 2 handles
| Handle ID | Type | Side | Status |
|-----------|------|------|--------|
| prompt | target | Left | ❌ **Wrong type** (should be 'text' not 'prompt') |
| reference | target | Left | ❌ type mismatch (should be 'image') |

**NODE_HANDLES.lyria** currently has: `['prompt', 'seed']`  
**Wrong**: Prompt should be `text`, reference should be `image`

---

#### **5. ImageToVideoNode.tsx** - 6 handles
| Handle ID | Type | Side | Status |
|-----------|------|------|--------|
| start | target | Left | ❌ **MISSING** |
| end | target | Left | ❌ **MISSING** |
| reference | target | Left | ❌ type mismatch |
| prompt | target | Left | ✅ IN NODE_HANDLES |
| motion | target | Left | ❌ **MISSING** |
| seed | target | Left | ❌ **MISSING** |

**NODE_HANDLES.imageToVideo** currently has: `['image', 'prompt']`  
**Missing**: `start`, `end`, `motion`, `seed`  
**Wrong**: `reference` should exist with type `image`

---

#### **6. Other Nodes with Variations**

| Node File | Handle ID | Type | Status |
|-----------|-----------|------|--------|
| StyleTransferNode | contentUrl | ❌ **MISSING** |
| StyleTransferNode | styleUrl | ❌ **MISSING** |
| PromptConcatenatorNode | in1, in2, in3, in4 | ❌ **MISSING** |
| MergeAlphaNode | rgb, alpha | ❌ **MISSING** |
| CompareNode | inputA, inputB | ❌ **MISSING** |
| BatchOutputSizerNode | imageUrl | ❌ **MISSING** |
| VideoDescriberNode | video | ❌ **MISSING** |

---

## 🔍 SYSTEMATIC COMPARISON: Complete NODE_HANDLES Audit

### **Group 1: Image Source Nodes (✅ OK)**

```typescript
imageUpload: {
  inputs: [],
  outputs: [{ id: 'image', type: 'image', label: 'Image' }]
}
videoUpload: {
  inputs: [],
  outputs: [{ id: 'video', type: 'video', label: 'Video' }]
}
```
✅ **Matches actual usage** - No inline handles, uses defaults

---

### **Group 2: Model Generation Nodes (❌ BROKEN)**

#### **Node: imagen**

**CURRENT (WRONG):**
```typescript
imagen: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
    { id: 'image', type: 'image', label: 'Reference Image (Optional)' }
  ],
  outputs: [{ id: 'image', type: 'image', label: 'Generated Image' }]
}
```

**CORRECT (✅ FIX):**
```typescript
imagen: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'reference', type: 'image', label: 'Reference Image (Optional)' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
    { id: 'guidance', type: 'number', label: 'Guidance Strength' },
    { id: 'cfg', type: 'number', label: 'CFG Scale' }
  ],
  outputs: [{ id: 'image', type: 'image', label: 'Generated Image' }]
}
```

**Changes Made:**
1. ✅ Changed `image` → `reference` (correct handle ID)
2. ✅ **Added** `guidance` handle
3. ✅ **Added** `cfg` handle

---

#### **Node: veo**

**CURRENT (WRONG):**
```typescript
veo: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
    { id: 'image', type: 'image', label: 'Reference Image (Optional)' }
  ],
  outputs: [{ id: 'video', type: 'video', label: 'Generated Video' }]
}
```

**CORRECT (✅ FIX):**
```typescript
veo: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'startFrame', type: 'image', label: 'Start Frame (Optional)' },
    { id: 'endFrame', type: 'image', label: 'End Frame (Optional)' },
    { id: 'reference', type: 'image', label: 'Reference Images' },
    { id: 'video', type: 'video', label: 'Input Video (Optional)' },
    { id: 'motion', type: 'motion', label: 'Motion Data (Optional)' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
  ],
  outputs: [{ id: 'video', type: 'video', label: 'Generated Video' }]
}
```

**Changes Made:**
1. ✅ Changed `image` → `reference` (correct handle ID)
2. ✅ **Added** `startFrame` handle
3. ✅ **Added** `endFrame` handle  
4. ✅ **Added** `video` handle
5. ✅ **Added** `motion` handle

---

#### **Node: llm**

**CURRENT (WRONG):**
```typescript
llm: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
  ],
  outputs: [{ id: 'text', type: 'text', label: 'Generated Text' }]
}
```

**CORRECT (✅ FIX):**
```typescript
llm: {
  inputs: [
    { id: 'text', type: 'text', label: 'Input Text' },
    { id: 'image', type: 'image', label: 'Input Image (Optional)' }
  ],
  outputs: [{ id: 'text', type: 'text', label: 'Generated Text' }]
}
```

**Changes Made:**
1. ✅ Replaced `prompt` → `text` (correct handle ID from LLMNode.tsx line 64)
2. ✅ Replaced `seed` → `image` (correct handle ID from LLMNode.tsx line 65)
3. ✅ Removed seed (not used in LLMNode)

---

#### **Node: lyria**

**CURRENT (WRONG):**
```typescript
lyria: {
  inputs: [
    { id: 'prompt', type: 'prompt', label: 'Prompt' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
  ],
  outputs: [{ id: 'audio', type: 'audio', label: 'Generated Audio' }]
}
```

**CORRECT (✅ FIX):**
```typescript
lyria: {
  inputs: [
    { id: 'prompt', type: 'text', label: 'Text Prompt' },
    { id: 'reference', type: 'image', label: 'Reference (Optional)' },
    { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
  ],
  outputs: [{ id: 'audio', type: 'audio', label: 'Generated Audio' }]
}
```

**Changes Made:**
1. ✅ Changed `prompt` type: `'prompt'` → `'text'`
2. ✅ Added `reference` handle
3. ✅ kept `seed` as-is

---

### **Group 3: Image Processing Nodes (✅ OK for now)**

```typescript
resize, blur, crop, invert, levels, channels, relight, imageUpscaler
// All use same pattern: [{ id: 'image', type: 'image', label: 'Image' }]
```
✅ **Matches actual usage** - No inline handles in these nodes

**Note**: StyleTransferNode has inline handles - needs to be added to NODE_HANDLES with `contentUrl` and `styleUrl` inputs.

---

### **Group 4: Other Nodes with Custom Inline Handles** ✅ NEW ADDITIONS NEEDED

#### **7 Missing Node Definitions to ADD:**

```typescript
// 1. StyleTransferNode
styleTransfer: {
  inputs: [
    { id: 'contentUrl', type: 'image', label: 'Content Image' },
    { id: 'styleUrl', type: 'image', label: 'Style Image' }
  ],
  outputs: [{ id: 'image', type: 'image', label: 'Styled Image' }]
}

// 2. PromptConcatenatorNode  
promptConcatenator: {
  inputs: [
    { id: 'in1', type: 'prompt', label: 'Prompt 1' },
    { id: 'in2', type: 'prompt', label: 'Prompt 2' },
    { id: 'in3', type: 'prompt', label: 'Prompt 3' },
    { id: 'in4', type: 'prompt', label: 'Prompt 4' }
  ],
  outputs: [{ id: 'prompt', type: 'prompt', label: 'Combined Prompt' }]
}

// 3. MergeAlphaNode
mergeAlpha: {
  inputs: [
    { id: 'rgb', type: 'image', label: 'RGB Image' },
    { id: 'alpha', type: 'mask', label: 'Alpha Mask' }
  ],
  outputs: [{ id: 'image', type: 'image', label: 'Merged Image' }]
}

// 4. CompareNode
compare: {
  inputs: [
    { id: 'inputA', type: 'image', label: 'Input A' },
    { id: 'inputB', type: 'image', label: 'Input B' }
  ],
  outputs: [{ id: 'comparison', type: 'image', label: 'Comparison' }]
}

// 5. BatchOutputSizerNode
batchOutputSizer: {
  inputs: [{ id: 'imageUrl', type: 'image', label: 'Image' }],
  outputs: [{ id: 'image', type: 'image', label: 'Resized Image' }]
}

// 6. VideoDescriberNode
videoDescriber: {
  inputs: [{ id: 'video', type: 'video', label: 'Video' }],
  outputs: [{ id: 'text', type: 'text', label: 'Description' }]
}
```

---

## ✅ CORRECTION SUMMARY

### **Changes Needed in NODE_HANDLES:**

1. **imagen**: Add 2 handles (guidance, cfg), rename image→reference
2. **veo**: Add 4 handles (startFrame, endFrame, video, motion), rename image→reference
3. **llm**: Replace 2 handles (prompt→text, seed→image)
4. **lyria**: Add 1 handle (reference), change type (prompt→text)
5. **imageToVideo**: Add 4 handles (start, end, motion, seed), fix reference
6. **ADD 7 NEW** node definitions (styleTransfer, promptConcatenator, mergeAlpha, compare, batchOutputSizer, videoDescriber)

**Total Changes:**
- **9 nodes to MODIFY** (imagen, veo, llm, lyria, imageToVideo, prompt, nanoBanana, nanoBananaPro)
- **7 nodes to ADD** (styleTransfer, promptConcatenator, mergeAlpha, compare, batchOutputSizer, videoDescriber)
- **20+ handles to ADD** across all nodes

---

## 📋 ACTION ITEMS

**Priority 1 - CRITICAL (Connectors not working):**
- [ ] Fix imagen handles
- [ ] Fix veo handles
- [ ] Fix llm handles
- [ ] Fix lyria handles

**Priority 2 - HIGH (Node functionality broken):**
- [ ] Add missing node definitions (7 nodes)
- [ ] Fix imageToVideo handles

**Priority 3 - MEDIUM (Cleanup):**
- [ ] Rebuild project
- [ ] Test all connections
- [ ] Verify no validation errors

---

## 🏗️ RECOMMENDATION

**NEED TO COMPLETELY REWRITE NODE_HANDLES** to match actual inline handle usage across all node files.

Current NODE_HANDLES is **~50% complete** causing:
- ❌ Connection validation failures
- ❌ False positive "invalid connection" errors
- ❌ Handles not rendering with correct colors
- ❌ Connection logic not working as expected

**Solution**: Complete systematic audit and correction as outlined above.
