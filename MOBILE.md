# Level Editor - Mobile Support

The level editor now supports both desktop and mobile workflows!

## 🎨 Desktop Experience (≥768px)

**Layout:** Classic 3-column design
- Left sidebar: Tools, image upload, level metadata
- Center: Canvas workspace
- Right sidebar: Pieces management, export

**Interaction:**
- Click to add points
- Double-click to finish piece
- Mouse hover for preview lines

---

## 📱 Mobile Experience (<768px)

**Layout:** Single-column with bottom tabs
- Canvas takes full screen
- Bottom tab bar: `📐 Tools` | `🧩 Pieces`
- Tap tabs to open bottom sheet panel

**Touch Interactions:**
- **Tap** canvas to add points
- **Floating ✓ button** appears when drawing (shows point count)
- **Tap ✓ button** to finish piece (replaces double-tap)
- **Double-tap** also works for finishing pieces
- **Touch and drag** for preview lines

**Mobile Optimizations:**
- 48×48px touch targets (vs 32×32px desktop)
- Larger buttons (min 48px height)
- Dynamic canvas sizing (scales to screen width)
- Bottom sheet slides up when tapping tabs
- Sticky modal header/footer for easy JSON export

---

## 🔧 Features

### Responsive Canvas
- **Desktop:** Fixed 600×800px
- **Mobile:** Scales to screen width (max 600px)
- **Aspect ratio:** Maintains 4:3 ratio on mobile

### Mobile Tab Bar
- **Tools Tab:** Image upload, draw/select tools, colors, level metadata
- **Pieces Tab:** Silhouette tracing, auto-generate, piece list, export

### Touch Events
- Prevents default scroll behavior on canvas
- Double-tap detection (300ms window)
- Touch move triggers preview line
- Tap outside panel to close

### Floating Finish Button
- Appears when 3+ points drawn
- Shows point count: `✓ 5`
- Green circular button (bottom-right)
- Auto-hides when not drawing

### Export Modal Improvements
- **Sticky header** with close button (always visible)
- **Scrollable body** for long JSON
- **Sticky footer** with action buttons (always visible)
- Mobile: full-width buttons, stacked layout

---

## 🐛 Known Issues & Limitations

1. **No pinch-to-zoom** - Canvas is fixed scale for now
2. **No pan/scroll** - View entire canvas only
3. **Piece selection** - Can be finicky on small screens (use Pieces tab)

---

## 🚀 Usage Tips

### On Mobile:
1. Load image via **Tools** tab
2. Tap **Quick Generate** for instant level
3. Use **Pieces** tab to view/delete pieces
4. Tap **Export JSON** → **Copy to Clipboard**
5. Tap ✓ button instead of double-tapping to finish pieces

### On Desktop:
- Everything works as before
- Modal scroll issue fixed (sticky header/footer)
- Improved tablet support (768-1024px)

---

## 💡 Future Enhancements

- [ ] Pinch-to-zoom canvas (if needed)
- [ ] Swipe gesture to switch tabs
- [ ] Undo/redo swipe gestures
- [ ] Piece rotation on mobile
- [ ] Canvas pan for zoomed view

---

## 🔨 Technical Details

**Breakpoints:**
- Mobile: `max-width: 768px`
- Tablet: `769px - 1024px`
- Desktop: `≥1025px`

**Touch Events:**
- `touchstart` → `click` equivalent
- `touchmove` → `mousemove` equivalent
- `touchend` → double-tap detection

**Canvas Sizing:**
```javascript
// Mobile
containerWidth = min(window.innerWidth - 40, 600)
canvasHeight = containerWidth * (4/3)

// Desktop
canvas = 600 × 800 (fixed)
```

**Panel Management:**
- Desktop: panels always visible (grid layout)
- Mobile: panels hidden, shown as bottom sheet on tab tap
- Event listeners re-attached on panel content clone

---

Made with ❤️ for Shape Fate
