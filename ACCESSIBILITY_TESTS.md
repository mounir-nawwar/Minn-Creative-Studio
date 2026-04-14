# BaseNode Accessibility Testing Guide

Quick reference for manually testing ARIA compliance in BaseNode.tsx

## 🧪 Manual Testing Checklist

### 1. Keyboard Navigation Test

#### Delete Button Keyboard Access
- [ ] Press `Tab` to navigate to a node
- [ ] Press `Tab` again to focus the delete button
- [ ] Verify: Blue focus ring appears around delete button
- [ ] Press `Enter` - Node should delete
- [ ] Undo and test again with `Space` key - Node should delete
- [ ] Verify: Screen reader announces "Deleting [node name] node"

**Expected Result**: Delete button is fully keyboard accessible

### 2. Focus Management Test

#### Focus Ring Visibility
- [ ] Click on node background (not delete button)
- [ ] Press `Tab` until delete button is focused
- [ ] Verify: 2px blue ring appears (#3B82F6 / rgb(59, 130, 246))
- [ ] Verify: Ring has sufficient contrast against dark background
- [ ] Press `Tab` away from delete button
- [ ] Verify: Ring disappears when focus is lost

**Expected Result**: Focus indicators meet WCAG 2.1 AA requirements

### 3. Screen Reader Test

#### Initial Load Announcements
- [ ] Enable screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Refresh page with nodes
- [ ] Verify: Each node announces "[Node Name] node. Ready for connections."

#### Delete Button Announcements
- [ ] Focus delete button with keyboard
- [ ] Verify: Screen reader announces "Delete [Node Name] node. Press Enter or Space to delete."
- [ ] Press Enter to delete
- [ ] Verify: Screen reader announces "Deleting [Node Name] node"

#### Error Announcements
- [ ] Trigger an error in a node (e.g., invalid input)
- [ ] Verify: Error message appears in red bar at bottom of node
- [ ] Verify: Screen reader immediately announces "Error: [error message]"
- [ ] Verify: AlertCircle icon has descriptive alt text

**Expected Result**: All dynamic content is announced to screen readers

### 4. Connection Status Test

#### During Connection Drag
- [ ] Click and drag from an output handle
- [ ] Hover over another node's input handle
- [ ] Verify: Screen reader announces "Connecting from [source] to [target] node. Hover over handles to check connection validity."
- [ ] Verify: Hovered handle color changes (green for valid, red for invalid)
- [ ] Release to complete or cancel connection
- [ ] Verify: Connection status message clears

**Expected Result**: Real-time feedback via ARIA live regions

### 5. Color Contrast Test

#### Text Contrast Ratios
Use browser dev tools or WCAG contrast checker:

- [ ] Node label (gray-400 on #1a1a1a): **7.5:1** ✓
- [ ] Regular text (gray-400 on #111111): **7.5:1** ✓
- [ ] Handle cyan (#0097A7 on #111111): **4.6:1** ✓
- [ ] Error red (#ef4444 on dark background): **5.2:1** ✓
- [ ] Focus ring blue (#3B82F6 on #111111): **4.8:1** ✓

**Expected Result**: All ratios ≥ 4.5:1 (WCAG 2.1 AA standard)

### 6. Semantic HTML Test

#### ARIA Attributes
- [ ] Inspect node container in dev tools
- [ ] Verify: `role="group"`
- [ ] Verify: `aria-label="[Node Name] node"`
- [ ] Inspect delete button
- [ ] Verify: `role="button"`
- [ ] Verify: `aria-label` includes action instructions
- [ ] Inspect handles
- [ ] Verify: `role="button"`
- [ ] Verify: `aria-label` describes handle purpose
- [ ] Inspect error container
- [ ] Verify: `role="alert"`
- [ ] Verify: `aria-live="assertive"`
- [ ] Inspect loading spinner
- [ ] Verify: `aria-label="Node is running"`

**Expected Result**: All interactive elements have correct ARIA attributes

### 7. Tab Order Test

#### Logical Flow
- [ ] Press `Tab` repeatedly to navigate through nodes
- [ ] Verify: Each delete button is reachable
- [ ] Verify: Tab order matches visual order
- [ ] Verify: No "tab traps" (can tab out of nodes)
- [ ] Verify: Shift+Tab works in reverse

**Expected Result**: Logical and predictable tab navigation

### 8. Visual Focus Indicators Test

#### Focus Ring Styles
- [ ] Focus delete button
- [ ] Inspect in dev tools
- [ ] Verify: `outline: none` (custom focus ring used)
- [ ] Verify: `box-shadow: 0 0 0 2px rgb(59, 130, 246)`
- [ ] Verify: Focus ring is visible against background
- [ ] Verify: Ring is at least 2px wide

**Expected Result**: Custom focus ring meets WCAG focus indicator guidelines

### 9. Dynamic Content Test

#### ARIA Live Regions
- [ ] Inspect page source for ARIA live regions
- [ ] Verify: `role="status"` container exists
- [ ] Verify: `aria-live="polite"` for non-urgent updates
- [ ] Verify: `aria-atomic="true"` for complete announcements
- [ ] Verify: `role="log"` container for connection events
- [ ] Trigger node run from toolbar
- [ ] Verify: Screen reader announces "Running [node name] node"

**Expected Result**: Dynamic updates announced to screen readers

### 10. Error Handling Test

#### Error Announcements
- [ ] Cause a node to error (e.g., invalid configuration)
- [ ] Verify: Red error bar appears at bottom of node
- [ ] Verify: Error icon (AlertCircle) appears in header
- [ ] Verify: Screen reader immediately announces error
- [ ] Fix error
- [ ] Verify: Error message disappears
- [ ] Verify: Screen reader does not announce removal (non-intrusive)

**Expected Result**: Errors announced assertively, fixes silent

## 📱 Platform-Specific Tests

### Windows (NVDA)
- [ ] Test with NVDA screen reader
- [ ] Verify all announcements work with Firefox
- [ ] Verify all announcements work with Chrome
- [ ] Verify keyboard shortcuts with NVDA

### macOS (VoiceOver)
- [ ] Test with VoiceOver screen reader
- [ ] Verify all announcements work with Safari
- [ ] Verify all announcements work with Chrome
- [ ] Verify keyboard shortcuts with VoiceOver

### Linux (Orca)
- [ ] Test with Orca screen reader
- [ ] Verify all announcements work with Firefox
- [ ] Verify keyboard shortcuts with Orca

## 🤖 Automated Testing

### Axe DevTools
```bash
# Install and run
npm install -g @axe-core/cli
axe http://localhost:5173 --tags wcag2aa
```

Expected: 0 violations for BaseNode component

### WAVE
```bash
# Install browser extension and test
https://wave.webaim.org/extension/
```

Expected: No red errors for BaseNode

### Lighthouse
```bash
# Run accessibility audit in Chrome DevTools
# Expected: 100/100 for accessibility
```

## 📝 Test Results Template

```markdown
## Accessibility Test Results - [Date]

**Tester**: [Name]
**Screen Reader**: [NVDA/JAWS/VoiceOver]
**Browser**: [Chrome/Firefox/Safari]
**OS**: [Windows/macOS/Linux]

### Results

1. ✅ **Keyboard Navigation**: All delete buttons keyboard accessible
2. ✅ **Focus Management**: Blue rings visible and meet contrast requirements
3. ✅ **Screen Reader**: All announcements working correctly
4. ✅ **Color Contrast**: All ratios ≥ 4.5:1
5. ✅ **Semantic HTML**: All ARIA attributes correct
6. ✅ **Tab Order**: Logical and predictable flow
7. ✅ **Visual Focus**: Custom rings meet WCAG standards
8. ✅ **Dynamic Content**: Live regions working
9. ✅ **Error Handling**: Errors announced, fixes silent
10. ❌ **Issue Found**: [Description]

**Overall Score**: [X]/10
**Status**: [PASS/FAIL]
```

## 🔧 Troubleshooting

### Issue: Focus ring not visible
- Check: Ensure `focus:ring-2` class is applied
- Check: Verify `ring-blue-500` has sufficient contrast
- Check: Make sure `outline-none` is not overriding

### Issue: Screen reader not announcing
- Check: Verify `aria-live="polite"` is set
- Check: Ensure `role="status"` is applied
- Check: Content changes must be actual DOM changes

### Issue: Delete button not keyboard accessible
- Check: Verify `tabIndex={0}` on button
- Check: Ensure `onKeyDown` handler exists
- Check: Validate `handleDeleteKeyDown` implementation

### Issue: Poor color contrast
- Check: Use contrast checker tool
- Check: Background must be dark enough for text
- Check: Ensure no semi-transparent overlays

## 🎯 Success Criteria

All tests should pass with:
- ✅ 100% keyboard accessibility
- ✅ WCAG 2.1 AA compliance
- ✅ Proper ARIA labels and roles
- ✅ Clear focus indicators
- ✅ Screen reader compatibility
- ✅ No automated tool violations

## 📞 Support

If accessibility issues are found:
1. Document the specific issue
2. Note browser/screen reader version
3. Take screenshots if visual
4. Record video if interaction issue
5. Report in GitHub Issues with template

---

**Last Updated**: 2026-04-14
**Component**: BaseNode.tsx
**WCAG Level**: 2.1 AA
