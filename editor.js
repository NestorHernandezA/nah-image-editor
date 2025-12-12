// Shape Fate Level Editor
// ========================

class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');

        // State
        this.image = null;
        this.imageData = null;
        this.silhouette = [];  // Array of normalized points
        this.pieces = [];      // Array of { id, color, vertices, startPos }
        this.currentPiece = []; // Points being drawn
        this.currentTool = 'draw';
        this.currentColor = '#99CCFF';
        this.selectedPieceIndex = -1;
        this.backgroundTolerance = 50;
        this.useInteriorSampling = true;
        this.showFullImage = false;
        this.showScattered = false;

        // Undo history
        this.history = [];
        this.maxHistory = 50;

        // Canvas sizing
        this.canvasWidth = 600;
        this.canvasHeight = 800;
        this.imageScale = 1;
        this.imageOffsetX = 0;
        this.imageOffsetY = 0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.render();
    }

    // Save current state to history
    saveState() {
        const state = {
            silhouette: JSON.parse(JSON.stringify(this.silhouette)),
            pieces: JSON.parse(JSON.stringify(this.pieces)),
            currentPiece: JSON.parse(JSON.stringify(this.currentPiece))
        };
        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.updateUndoButton();
    }

    // Undo last action
    undo() {
        if (this.history.length === 0) return;

        const state = this.history.pop();
        this.silhouette = state.silhouette;
        this.pieces = state.pieces;
        this.currentPiece = state.currentPiece;
        this.selectedPieceIndex = -1;

        this.updatePieceList();
        this.updateUndoButton();
        this.render();
    }

    updateUndoButton() {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.disabled = this.history.length === 0;
            undoBtn.style.opacity = this.history.length === 0 ? '0.5' : '1';
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z or Cmd+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            // Escape to cancel current piece
            if (e.key === 'Escape') {
                if (this.currentPiece.length > 0) {
                    this.currentPiece = [];
                    this.render();
                }
            }
            // Delete/Backspace to remove selected piece
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedPieceIndex >= 0) {
                e.preventDefault();
                this.saveState();
                this.pieces.splice(this.selectedPieceIndex, 1);
                this.selectedPieceIndex = -1;
                this.updatePieceList();
                this.render();
            }
        });
    }

    setupEventListeners() {
        // Image drop zone
        const dropZone = document.getElementById('dropZone');
        const imageInput = document.getElementById('imageInput');

        dropZone.addEventListener('click', () => imageInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadImage(file);
        });

        // Canvas events
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));

        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });

        // Color options
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.currentColor = opt.dataset.color;
            });
        });

        // Background tolerance slider
        const toleranceSlider = document.getElementById('backgroundTolerance');
        const toleranceValue = document.getElementById('backgroundToleranceValue');
        if (toleranceSlider) {
            this.backgroundTolerance = parseInt(toleranceSlider.value, 10);
            if (toleranceValue) {
                toleranceValue.textContent = toleranceSlider.value;
            }
            toleranceSlider.addEventListener('input', () => {
                this.backgroundTolerance = parseInt(toleranceSlider.value, 10);
                if (toleranceValue) {
                    toleranceValue.textContent = toleranceSlider.value;
                }
            });
        }

        // Interior sampling toggle
        const interiorCheckbox = document.getElementById('useInteriorSampling');
        if (interiorCheckbox) {
            this.useInteriorSampling = interiorCheckbox.checked;
            interiorCheckbox.addEventListener('change', () => {
                this.useInteriorSampling = interiorCheckbox.checked;
            });
        }

        // Show full image toggle
        const showImageCheckbox = document.getElementById('showFullImage');
        if (showImageCheckbox) {
            showImageCheckbox.addEventListener('change', () => {
                this.showFullImage = showImageCheckbox.checked;
                this.render();
            });
        }

        // Manual mask import
        const loadMaskBtn = document.getElementById('loadMaskImage');
        const maskInput = document.getElementById('maskInput');
        if (loadMaskBtn && maskInput) {
            loadMaskBtn.addEventListener('click', () => maskInput.click());
            maskInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadMaskFromImage(file);
                }
                maskInput.value = '';
            });
        }

        // Undo button
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        // Trace silhouette
        document.getElementById('traceSilhouette').addEventListener('click', () => {
            this.autoTraceSilhouette();
        });

        // Auto-split pieces
        document.getElementById('autoSplit').addEventListener('click', () => {
            this.autoSplitPieces();
        });

        // Quick generate (trace + split in one click)
        document.getElementById('quickGenerate').addEventListener('click', () => {
            this.quickGenerate();
        });

        // Preview scattered pieces
        document.getElementById('previewScatter').addEventListener('click', () => {
            this.toggleScatterPreview();
        });

        // Export piece images
        document.getElementById('exportPieceImages').addEventListener('click', () => {
            this.exportPieceImages();
        });

        // Clear all
        document.getElementById('clearAll').addEventListener('click', () => {
            if (confirm('Clear all pieces and silhouette?')) {
                this.saveState(); // Save before clearing
                this.silhouette = [];
                this.pieces = [];
                this.currentPiece = [];
                this.updatePieceList();
                this.render();
            }
        });

        // Export
        document.getElementById('exportJson').addEventListener('click', () => this.showExportModal());
        document.getElementById('copyJson').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('exportModal').classList.remove('active');
        });
        document.getElementById('downloadJson').addEventListener('click', () => this.downloadJson());
        document.getElementById('copyJsonModal').addEventListener('click', () => this.copyToClipboard());
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.fitImageToCanvas();
                this.render();
                document.getElementById('canvasInfo').textContent =
                    `${img.width}x${img.height} - Click to trace`;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    fitImageToCanvas() {
        if (!this.image) return;

        const imgAspect = this.image.width / this.image.height;
        const canvasAspect = this.canvasWidth / this.canvasHeight;

        if (imgAspect > canvasAspect) {
            // Image is wider - fit to width
            this.imageScale = this.canvasWidth / this.image.width;
        } else {
            // Image is taller - fit to height
            this.imageScale = this.canvasHeight / this.image.height;
        }

        // Center the image
        const scaledWidth = this.image.width * this.imageScale;
        const scaledHeight = this.image.height * this.imageScale;
        this.imageOffsetX = (this.canvasWidth - scaledWidth) / 2;
        this.imageOffsetY = (this.canvasHeight - scaledHeight) / 2;
    }

    // Convert canvas coordinates to normalized (0-1)
    canvasToNormalized(x, y) {
        const nx = (x - this.imageOffsetX) / (this.image.width * this.imageScale);
        const ny = (y - this.imageOffsetY) / (this.image.height * this.imageScale);
        return { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) };
    }

    // Convert normalized to canvas coordinates
    normalizedToCanvas(nx, ny) {
        const x = nx * this.image.width * this.imageScale + this.imageOffsetX;
        const y = ny * this.image.height * this.imageScale + this.imageOffsetY;
        return { x, y };
    }

    handleCanvasClick(e) {
        if (!this.image) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === 'draw') {
            const point = this.canvasToNormalized(x, y);
            this.currentPiece.push(point);
            this.render();
        } else if (this.currentTool === 'select') {
            this.selectPieceAt(x, y);
        }
    }

    handleCanvasDoubleClick(e) {
        if (this.currentTool === 'draw' && this.currentPiece.length >= 3) {
            this.finishPiece();
        }
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.image) {
            const norm = this.canvasToNormalized(x, y);
            document.getElementById('canvasInfo').textContent =
                `(${norm.x.toFixed(3)}, ${norm.y.toFixed(3)})`;
        }

        // Preview line while drawing
        if (this.currentTool === 'draw' && this.currentPiece.length > 0) {
            this.render();
            // Draw preview line to cursor
            const lastPoint = this.currentPiece[this.currentPiece.length - 1];
            const lastCanvas = this.normalizedToCanvas(lastPoint.x, lastPoint.y);
            this.ctx.beginPath();
            this.ctx.moveTo(lastCanvas.x, lastCanvas.y);
            this.ctx.lineTo(x, y);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    finishPiece() {
        if (this.currentPiece.length < 3) return;

        this.saveState(); // Save before adding piece

        const piece = {
            id: `piece_${this.pieces.length + 1}`,
            color: this.currentColor,
            vertices: [...this.currentPiece],
            startPos: this.calculateStartPos(this.currentPiece)
        };

        this.pieces.push(piece);
        this.currentPiece = [];
        this.updatePieceList();
        this.render();

        // Cycle to next color
        this.cycleColor();
    }

    calculateStartPos(vertices) {
        // Random position at bottom of screen for puzzle pieces
        const centerX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
        return {
            x: 0.1 + Math.random() * 0.8,
            y: 0.75 + Math.random() * 0.15
        };
    }

    calculateCenter(vertices) {
        if (!vertices || vertices.length === 0) {
            return { x: 0.5, y: 0.5 };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        vertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        });

        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    }

    cycleColor() {
        const colors = ['#99CCFF', '#FFADAD', '#B3F2B3', '#FFE699', '#E6B3FF', '#FFB366'];
        const currentIndex = colors.indexOf(this.currentColor);
        const nextIndex = (currentIndex + 1) % colors.length;
        this.currentColor = colors[nextIndex];

        // Update UI
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === this.currentColor);
        });
    }

    selectPieceAt(x, y) {
        const point = this.canvasToNormalized(x, y);

        // Find piece containing this point
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            if (this.pointInPolygon(point, this.pieces[i].vertices)) {
                this.selectedPieceIndex = i;
                this.updatePieceList();
                this.render();
                return;
            }
        }

        this.selectedPieceIndex = -1;
        this.updatePieceList();
        this.render();
    }

    pointInPolygon(point, vertices) {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x, yi = vertices[i].y;
            const xj = vertices[j].x, yj = vertices[j].y;
            if ((yi > point.y) !== (yj > point.y) &&
                point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Auto-split the silhouette into N pieces using grid-based approach
    // Pieces are clipped to the silhouette boundary
    autoSplitPieces() {
        if (this.silhouette.length < 3) {
            alert('Please trace a silhouette first');
            return;
        }

        const numPieces = parseInt(document.getElementById('numPieces').value) || 5;

        this.saveState();

        // Find bounding box of silhouette
        const minX = Math.min(...this.silhouette.map(p => p.x));
        const maxX = Math.max(...this.silhouette.map(p => p.x));
        const minY = Math.min(...this.silhouette.map(p => p.y));
        const maxY = Math.max(...this.silhouette.map(p => p.y));

        const colors = ['#99CCFF', '#FFADAD', '#B3F2B3', '#FFE699', '#E6B3FF', '#FFB366'];

        let workingPieces = [this.silhouette.map(p => ({ ...p }))];
        const maxAttempts = numPieces * 30;
        let attempts = 0;

        while (workingPieces.length < numPieces && attempts < maxAttempts) {
            attempts++;

            // Split the largest remaining piece to avoid tiny fragments early
            let largestIndex = 0;
            let largestArea = Math.abs(this.polygonArea(workingPieces[0]));
            for (let i = 1; i < workingPieces.length; i++) {
                const area = Math.abs(this.polygonArea(workingPieces[i]));
                if (area > largestArea) {
                    largestArea = area;
                    largestIndex = i;
                }
            }

            const targetPiece = workingPieces[largestIndex];
            const splitResult = this.splitPolygonRandomly(targetPiece, largestArea, workingPieces.length, numPieces);

            if (splitResult) {
                workingPieces.splice(largestIndex, 1);
                workingPieces.push(splitResult.front, splitResult.back);
            }
        }

        if (workingPieces.length < numPieces) {
            console.warn(`Auto-split produced ${workingPieces.length} pieces (target ${numPieces})`);
        }

        // Clear existing pieces and rebuild from generated polygons
        this.pieces = workingPieces.slice(0, numPieces).map((vertices, index) => ({
            id: `piece_${index + 1}`,
            color: colors[index % colors.length],
            vertices,
            startPos: {
                x: 0.1 + Math.random() * 0.8,
                y: 0.75 + Math.random() * 0.15
            }
        }));

        console.log(`Created ${this.pieces.length} organic pieces (target ${numPieces})`);

        this.updatePieceList();
        this.render();
    }

    // Quick generate: trace silhouette + auto-split in one click
    quickGenerate() {
        if (!this.image) {
            alert('Please load an image first');
            return;
        }

        // Save state before making changes
        this.saveState();

        // First, trace the silhouette
        this.autoTraceSilhouette();

        // Then auto-split into pieces
        if (this.silhouette.length >= 3) {
            this.autoSplitPieces();

            // Auto-enable image mode for convenience
            const imageModeCheckbox = document.getElementById('imageMode');
            if (imageModeCheckbox) {
                imageModeCheckbox.checked = true;
            }

            // Auto-increment level ID
            this.autoIncrementLevelId();
        }
    }

    // Auto-increment level ID based on current value
    autoIncrementLevelId() {
        const levelIdInput = document.getElementById('levelId');
        if (!levelIdInput) return;

        const currentId = levelIdInput.value;
        const match = currentId.match(/^level_(\d+)$/);
        if (match) {
            const currentNum = parseInt(match[1], 10);
            // Only increment if it looks like we're on a fresh level
            // (don't increment if user is editing)
        }
    }

    // Toggle between showing pieces in place vs scattered (preview mode)
    toggleScatterPreview() {
        if (this.pieces.length === 0) {
            alert('No pieces to preview');
            return;
        }

        this.showScattered = !this.showScattered;

        // Update button text
        const btn = document.getElementById('previewScatter');
        if (btn) {
            if (this.showScattered) {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                    Show In Place
                `;
            } else {
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"/>
                        <circle cx="6" cy="18" r="1"/>
                        <circle cx="18" cy="18" r="1"/>
                        <circle cx="8" cy="6" r="1"/>
                        <circle cx="16" cy="8" r="1"/>
                    </svg>
                    Preview Scattered
                `;
            }
        }

        this.render();
    }

    // Clip (possibly concave) subject polygon to a convex clip polygon (e.g., grid cell)
    clipPolygonToPolygon(subjectPolygon, clipPolygon) {
        if (subjectPolygon.length === 0 || clipPolygon.length < 3) {
            return [];
        }

        const isClipClockwise = this.isPolygonClockwise(clipPolygon);
        let outputList = [...subjectPolygon];

        for (let i = 0; i < clipPolygon.length; i++) {
            if (outputList.length === 0) break;

            const inputList = outputList;
            outputList = [];

            const edgeStart = clipPolygon[i];
            const edgeEnd = clipPolygon[(i + 1) % clipPolygon.length];

            for (let j = 0; j < inputList.length; j++) {
                const current = inputList[j];
                const previous = inputList[(j + inputList.length - 1) % inputList.length];

                const currentInside = this.isPointInsideEdge(current, edgeStart, edgeEnd, isClipClockwise);
                const previousInside = this.isPointInsideEdge(previous, edgeStart, edgeEnd, isClipClockwise);

                if (currentInside) {
                    if (!previousInside) {
                        // Entering: add intersection point
                        const intersection = this.lineIntersection(previous, current, edgeStart, edgeEnd);
                        if (intersection) outputList.push(intersection);
                    }
                    outputList.push(current);
                } else if (previousInside) {
                    // Leaving: add intersection point
                    const intersection = this.lineIntersection(previous, current, edgeStart, edgeEnd);
                    if (intersection) outputList.push(intersection);
                }
            }
        }

        return outputList;
    }

    // Check if point is on the inside side of the edge (supports CW + CCW silhouettes)
    isPointInsideEdge(point, lineStart, lineEnd, clipIsClockwise) {
        const cross = ((lineEnd.x - lineStart.x) * (point.y - lineStart.y)) -
                      ((lineEnd.y - lineStart.y) * (point.x - lineStart.x));
        return clipIsClockwise ? cross <= 0 : cross >= 0;
    }

    isPolygonClockwise(vertices) {
        if (vertices.length < 3) return false;

        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            area += (current.x * next.y) - (next.x * current.y);
        }

        return area < 0;
    }

    polygonArea(vertices) {
        if (vertices.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            area += (current.x * next.y) - (next.x * current.y);
        }
        return area / 2;
    }

    // Find intersection point of two line segments
    lineIntersection(p1, p2, p3, p4) {
        const s1x = p2.x - p1.x;
        const s1y = p2.y - p1.y;
        const s2x = p4.x - p3.x;
        const s2y = p4.y - p3.y;

        const denom = (-s2x * s1y + s1x * s2y);
        if (Math.abs(denom) < 1e-10) return null;

        const s = (-s1y * (p1.x - p3.x) + s1x * (p1.y - p3.y)) / denom;
        const t = ( s2x * (p1.y - p3.y) - s2y * (p1.x - p3.x)) / denom;

        if (s < -1e-5 || s > 1 + 1e-5 || t < -1e-5 || t > 1 + 1e-5) {
            return null;
        }

        return {
            x: p1.x + (t * s1x),
            y: p1.y + (t * s1y)
        };
    }

    splitPolygonRandomly(polygon, polygonAreaValue, currentPieceCount, targetPieces) {
        const bounds = this.getPolygonBounds(polygon);
        const maxAttempts = 25;
        const totalArea = Math.abs(polygonAreaValue);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const px = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const py = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            const angle = Math.random() * Math.PI;
            const normal = { x: Math.cos(angle), y: Math.sin(angle) };

            const split = this.splitPolygonByLine(polygon, { x: px, y: py }, normal);
            if (!split) continue;

            const areaFront = Math.abs(this.polygonArea(split.front));
            const areaBack = Math.abs(this.polygonArea(split.back));
            if (areaFront < 1e-4 || areaBack < 1e-4) continue;

            const ratio = areaFront / (areaFront + areaBack);
            const minRatioBase = 0.3;
            const tolerance = Math.min(0.15 + (attempt * 0.02), 0.35);
            const minRatio = Math.max(0.05, minRatioBase - tolerance);
            const maxRatio = Math.min(0.95, 1 - minRatio);
            if (ratio < minRatio || ratio > maxRatio) continue;

            return split;
        }

        return null;
    }

    splitPolygonByLine(vertices, point, normal) {
        const EPS = 1e-5;
        const front = [];
        const back = [];
        const intersections = [];
        const bounds = this.getPolygonBounds(vertices);
        const diag = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        const minSplitLength = Math.max(0.02, diag * 0.12);

        const signedDistance = (v) => (v.x - point.x) * normal.x + (v.y - point.y) * normal.y;

        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            const next = vertices[(i + 1) % vertices.length];

            const dCurrent = signedDistance(current);
            const dNext = signedDistance(next);

            const onCurrent = Math.abs(dCurrent) < EPS;
            const onNext = Math.abs(dNext) < EPS;

            if (dCurrent > EPS) {
                front.push(current);
            } else if (dCurrent < -EPS) {
                back.push(current);
            } else {
                front.push(current);
                back.push(current);
            }

            if ((dCurrent > EPS && dNext < -EPS) || (dCurrent < -EPS && dNext > EPS)) {
                const t = dCurrent / (dCurrent - dNext);
                const intersection = {
                    x: current.x + (next.x - current.x) * t,
                    y: current.y + (next.y - current.y) * t
                };
                front.push(intersection);
                back.push(intersection);
                if (!intersections.some(pt => this.distanceSquared(pt, intersection) < EPS * EPS)) {
                    intersections.push(intersection);
                }
            } else if (onNext && !onCurrent) {
                // Ensure points lying exactly on the line are preserved in both polygons
                front.push(next);
                back.push(next);
                if (!intersections.some(pt => this.distanceSquared(pt, next) < EPS * EPS)) {
                    intersections.push(next);
                }
            }
        }

        const cleanedFront = this.cleanPolygon(front);
        const cleanedBack = this.cleanPolygon(back);

        if (cleanedFront.length < 3 || cleanedBack.length < 3) {
            return null;
        }

        if (intersections.length < 2) {
            return null;
        }

        // Ensure the cutting segment is long enough to avoid skinny connectors
        let maxDistSq = 0;
        for (let i = 0; i < intersections.length; i++) {
            for (let j = i + 1; j < intersections.length; j++) {
                const distSq = this.distanceSquared(intersections[i], intersections[j]);
                if (distSq > maxDistSq) {
                    maxDistSq = distSq;
                }
            }
        }
        if (maxDistSq < minSplitLength * minSplitLength) {
            return null;
        }

        return {
            front: cleanedFront,
            back: cleanedBack
        };
    }

    cleanPolygon(vertices) {
        const cleaned = [];
        const EPS = 1e-4;

        for (const point of vertices) {
            if (cleaned.length === 0 ||
                this.distanceSquared(cleaned[cleaned.length - 1], point) > EPS * EPS) {
                cleaned.push(point);
            }
        }

        if (cleaned.length >= 2 &&
            this.distanceSquared(cleaned[0], cleaned[cleaned.length - 1]) < EPS * EPS) {
            cleaned.pop();
        }

        return cleaned;
    }

    distanceSquared(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    getPolygonBounds(vertices) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        vertices.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { minX, minY, maxX, maxY };
    }

    // Export each piece as a separate PNG image (cut from original)
    exportPieceImages() {
        if (!this.image) {
            alert('Please load an image first');
            return;
        }

        if (this.pieces.length === 0) {
            alert('Please create some pieces first');
            return;
        }

        const zip = [];
        const levelId = document.getElementById('levelId').value || 'level_016';

        this.pieces.forEach((piece, index) => {
            // Create canvas for this piece
            const pieceCanvas = document.createElement('canvas');
            const pieceCtx = pieceCanvas.getContext('2d');

            // Calculate piece bounds in image coordinates
            const minX = Math.min(...piece.vertices.map(v => v.x));
            const maxX = Math.max(...piece.vertices.map(v => v.x));
            const minY = Math.min(...piece.vertices.map(v => v.y));
            const maxY = Math.max(...piece.vertices.map(v => v.y));

            const imgMinX = Math.floor(minX * this.image.width);
            const imgMaxX = Math.ceil(maxX * this.image.width);
            const imgMinY = Math.floor(minY * this.image.height);
            const imgMaxY = Math.ceil(maxY * this.image.height);

            const pieceWidth = imgMaxX - imgMinX;
            const pieceHeight = imgMaxY - imgMinY;

            pieceCanvas.width = pieceWidth;
            pieceCanvas.height = pieceHeight;

            // Create clipping path
            pieceCtx.beginPath();
            const firstV = piece.vertices[0];
            pieceCtx.moveTo(
                (firstV.x * this.image.width) - imgMinX,
                (firstV.y * this.image.height) - imgMinY
            );
            for (let i = 1; i < piece.vertices.length; i++) {
                const v = piece.vertices[i];
                pieceCtx.lineTo(
                    (v.x * this.image.width) - imgMinX,
                    (v.y * this.image.height) - imgMinY
                );
            }
            pieceCtx.closePath();
            pieceCtx.clip();

            // Draw the image portion
            pieceCtx.drawImage(
                this.image,
                imgMinX, imgMinY, pieceWidth, pieceHeight,
                0, 0, pieceWidth, pieceHeight
            );

            // Convert to data URL and trigger download
            const dataUrl = pieceCanvas.toDataURL('image/png');

            // Create download link
            const link = document.createElement('a');
            link.download = `${levelId}_piece_${index + 1}.png`;
            link.href = dataUrl;
            link.click();
        });

        alert(`Exported ${this.pieces.length} piece images!`);
    }

    autoTraceSilhouette() {
        if (!this.image) {
            alert('Please load an image first');
            return;
        }

        const maskResult = this.prepareMaskFromImage();
        if (!maskResult) {
            alert('Could not detect silhouette. Try using a simpler background or higher contrast.');
            return;
        }

        const contour = this.traceMaskBoundary(maskResult.mask, maskResult.width, maskResult.height);
        if (contour.length < 3) {
            alert('Silhouette detection failed. Please adjust the source image.');
            return;
        }

        this.saveState();
        this.silhouette = this.simplifyPath(contour, 0.0025);
        document.getElementById('silhouetteInfo').textContent =
            `${this.silhouette.length} points traced`;
        this.render();
    }

    prepareMaskFromImage() {
        const maxDim = 600;
        const scale = Math.min(maxDim / this.image.width, maxDim / this.image.height, 1);
        const width = Math.max(32, Math.round(this.image.width * scale));
        const height = Math.max(32, Math.round(this.image.height * scale));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.image, 0, 0, width, height);

        const imageData = tempCtx.getImageData(0, 0, width, height);
        const bgColor = this.sampleBackgroundColor(imageData.data, width, height);
        const threshold = this.computeBackgroundThreshold(imageData.data, width, height, bgColor, this.backgroundTolerance);
        const subjectMask = this.buildSubjectMask(imageData.data, width, height, bgColor, threshold);
        if (!subjectMask) return null;
        const largestMask = this.extractLargestRegion(subjectMask, width, height);
        if (!largestMask) return null;
        return {
            mask: largestMask,
            width,
            height
        };
    }

    loadMaskFromImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 800;
                const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                const width = Math.max(32, Math.round(img.width * scale));
                const height = Math.max(32, Math.round(img.height * scale));

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0, width, height);

                const imageData = tempCtx.getImageData(0, 0, width, height);
                const mask = new Uint8Array(width * height);
                let subjectPixels = 0;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        const alpha = imageData.data[idx + 3];
                        const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                        const maskIndex = y * width + x;
                        if (alpha > 40 || brightness < 240) {
                            mask[maskIndex] = 1;
                            subjectPixels++;
                        }
                    }
                }

                if (subjectPixels === 0) {
                    alert('Mask image did not contain any opaque pixels.');
                    return;
                }

                const largest = this.extractLargestRegion(mask, width, height) || mask;
                const contour = this.traceMaskBoundary(largest, width, height);
                if (!contour || contour.length < 3) {
                    alert('Unable to trace silhouette from mask image.');
                    return;
                }

                this.saveState();
                this.silhouette = this.simplifyPath(contour, 0.0025);
                document.getElementById('silhouetteInfo').textContent =
                    `Loaded mask (${this.silhouette.length} points)`;
                this.render();
            };
            img.onerror = () => alert('Unable to load mask image.');
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    sampleBackgroundColor(data, width, height) {
        const samples = [
            [0, 0],
            [width - 1, 0],
            [0, height - 1],
            [width - 1, height - 1],
            [Math.floor(width * 0.25), 0],
            [Math.floor(width * 0.75), 0],
            [Math.floor(width * 0.25), height - 1],
            [Math.floor(width * 0.75), height - 1],
            [0, Math.floor(height * 0.25)],
            [0, Math.floor(height * 0.75)],
            [width - 1, Math.floor(height * 0.25)],
            [width - 1, Math.floor(height * 0.75)]
        ];

        let r = 0, g = 0, b = 0;
        samples.forEach(([x, y]) => {
            const idx = (y * width + x) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
        });

        const count = samples.length;
        return {
            r: r / count,
            g: g / count,
            b: b / count
        };
    }

    computeBackgroundThreshold(data, width, height, bgColor, toleranceSlider = 50) {
        const diffs = [];
        const stepX = Math.max(1, Math.round(width / 24));
        const stepY = Math.max(1, Math.round(height / 24));

        for (let x = 0; x < width; x += stepX) {
            diffs.push(this.pixelDistance(data, width, x, 0, bgColor));
            diffs.push(this.pixelDistance(data, width, x, height - 1, bgColor));
        }
        for (let y = 0; y < height; y += stepY) {
            diffs.push(this.pixelDistance(data, width, 0, y, bgColor));
            diffs.push(this.pixelDistance(data, width, width - 1, y, bgColor));
        }

        if (diffs.length === 0) {
            return 40;
        }

        const mean = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
        const variance = diffs.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / diffs.length;
        const std = Math.sqrt(Math.max(0, variance));

        const baseThreshold = mean + std * 1.5 + 10;
        const adjustment = (toleranceSlider - 50) * 1.5;
        const finalThreshold = Math.min(200, Math.max(10, baseThreshold + adjustment));
        return finalThreshold;
    }

    pixelDistance(data, width, x, y, bgColor) {
        const idx = (y * width + x) * 4;
        return Math.sqrt(this.colorDistanceSquared(data[idx], data[idx + 1], data[idx + 2], bgColor));
    }

    colorDistanceSquared(r, g, b, color) {
        const dr = r - color.r;
        const dg = g - color.g;
        const db = b - color.b;
        return dr * dr + dg * dg + db * db;
    }

    buildSubjectMask(data, width, height, bgColor, threshold) {
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = [];
        const thresholdSq = threshold * threshold;

        const enqueueIfBackground = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            const idx = y * width + x;
            if (visited[idx]) return;
            const offset = idx * 4;
            const dist = this.colorDistanceSquared(data[offset], data[offset + 1], data[offset + 2], bgColor);
            if (dist <= thresholdSq) {
                visited[idx] = 1;
                queue.push(idx);
            }
        };

        for (let x = 0; x < width; x++) {
            enqueueIfBackground(x, 0);
            enqueueIfBackground(x, height - 1);
        }
        for (let y = 0; y < height; y++) {
            enqueueIfBackground(0, y);
            enqueueIfBackground(width - 1, y);
        }

        let head = 0;
        while (head < queue.length) {
            const idx = queue[head++];
            const x = idx % width;
            const y = Math.floor(idx / width);
            enqueueIfBackground(x + 1, y);
            enqueueIfBackground(x - 1, y);
            enqueueIfBackground(x, y + 1);
            enqueueIfBackground(x, y - 1);
        }

        const mask = new Uint8Array(total);
        let subjectPixels = 0;
        for (let i = 0; i < total; i++) {
            if (!visited[i]) {
                mask[i] = 1;
                subjectPixels++;
            }
        }

        if (subjectPixels === 0) {
            return null;
        }

        if (this.useInteriorSampling) {
            const interior = this.extractInteriorMask(data, width, height, bgColor, threshold);
            if (interior) {
                for (let i = 0; i < total; i++) {
                    if (interior[i]) mask[i] = 1;
                }
            }
        }

        return this.expandMask(mask, width, height, 2);
    }

    extractLargestRegion(mask, width, height) {
        const total = width * height;
        const visited = new Uint8Array(total);
        let bestRegion = null;
        const offsets = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ];

        for (let i = 0; i < total; i++) {
            if (!mask[i] || visited[i]) continue;

            const region = [];
            const queue = [i];
            let head = 0;
            visited[i] = 1;

            while (head < queue.length) {
                const idx = queue[head++];
                region.push(idx);
                const x = idx % width;
                const y = Math.floor(idx / width);

                offsets.forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
                    const nIdx = ny * width + nx;
                    if (mask[nIdx] && !visited[nIdx]) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                });
            }

            if (!bestRegion || region.length > bestRegion.length) {
                bestRegion = region;
            }
        }

        if (!bestRegion) return null;

        const regionMask = new Uint8Array(total);
        bestRegion.forEach(idx => {
            regionMask[idx] = 1;
        });
        return regionMask;
    }

    extractInteriorMask(data, width, height, bgColor, threshold) {
        const total = width * height;
        const mask = new Uint8Array(total);
        const extra = Math.max(15, threshold + 15);
        const extraSq = extra * extra;
        const marginX = Math.max(2, Math.floor(width * 0.05));
        const marginY = Math.max(2, Math.floor(height * 0.05));
        let count = 0;

        for (let y = marginY; y < height - marginY; y++) {
            for (let x = marginX; x < width - marginX; x++) {
                const idx = y * width + x;
                const offset = idx * 4;
                const r = data[offset];
                const g = data[offset + 1];
                const b = data[offset + 2];
                const distSq = this.colorDistanceSquared(r, g, b, bgColor);
                if (distSq >= extraSq) {
                    mask[idx] = 1;
                    count++;
                    continue;
                }
                const { s, v } = this.rgbToHsv(r, g, b);
                if (s >= 0.28 && v >= 0.1 && v <= 0.98) {
                    mask[idx] = 1;
                    count++;
                }
            }
        }

        if (count < Math.max(100, Math.floor(total * 0.01))) {
            return null;
        }

        return mask;
    }

    expandMask(mask, width, height, radius = 1) {
        if (!mask) return null;
        const expanded = new Uint8Array(mask.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (!mask[idx]) continue;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                        const nIdx = ny * width + nx;
                        expanded[nIdx] = 1;
                    }
                }
            }
        }
        return expanded;
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        const v = max;
        const delta = max - min;
        const s = max === 0 ? 0 : delta / max;

        if (delta !== 0) {
            switch (max) {
                case r:
                    h = ((g - b) / delta) % 6;
                    break;
                case g:
                    h = (b - r) / delta + 2;
                    break;
                default:
                    h = (r - g) / delta + 4;
                    break;
            }
            h *= 60;
            if (h < 0) h += 360;
        }

        return { h, s, v };
    }

    traceMaskBoundary(mask, width, height) {
        const segments = [];

        const getValue = (x, y) => mask[y * width + x] ? 1 : 0;

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const tl = getValue(x, y);
                const tr = getValue(x + 1, y);
                const br = getValue(x + 1, y + 1);
                const bl = getValue(x, y + 1);

                const intersections = [];
                if (tl !== tr) intersections.push(this.edgePoint('top', x, y));
                if (tr !== br) intersections.push(this.edgePoint('right', x, y));
                if (br !== bl) intersections.push(this.edgePoint('bottom', x, y));
                if (bl !== tl) intersections.push(this.edgePoint('left', x, y));

                if (intersections.length === 0) continue;

                if (intersections.length === 4) {
                    const diagTLBR = tl + br;
                    const diagTRBL = tr + bl;
                    if (diagTLBR > diagTRBL) {
                        segments.push([intersections[0], intersections[3]]);
                        segments.push([intersections[1], intersections[2]]);
                    } else {
                        segments.push([intersections[0], intersections[1]]);
                        segments.push([intersections[2], intersections[3]]);
                    }
                } else {
                    for (let i = 0; i < intersections.length; i += 2) {
                        segments.push([intersections[i], intersections[i + 1]]);
                    }
                }
            }
        }

        return this.connectSegmentsToPolygon(segments, width, height);
    }

    edgePoint(edge, x, y) {
        switch (edge) {
            case 'top':
                return { x: x + 0.5, y };
            case 'right':
                return { x: x + 1, y: y + 0.5 };
            case 'bottom':
                return { x: x + 0.5, y: y + 1 };
            case 'left':
                return { x, y: y + 0.5 };
            default:
                return { x, y };
        }
    }

    connectSegmentsToPolygon(segments, width, height) {
        if (segments.length === 0) return [];

        const nodes = new Map();
        const edgeUse = new Map();

        const pointKey = (pt) => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`;
        const addNode = (pt) => {
            const key = pointKey(pt);
            if (!nodes.has(key)) {
                nodes.set(key, { point: pt, neighbors: new Set() });
            }
            return nodes.get(key);
        };
        const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

        segments.forEach(([a, b]) => {
            const nodeA = addNode(a);
            const nodeB = addNode(b);
            const keyA = pointKey(a);
            const keyB = pointKey(b);
            nodeA.neighbors.add(keyB);
            nodeB.neighbors.add(keyA);
            const eKey = edgeKey(keyA, keyB);
            edgeUse.set(eKey, (edgeUse.get(eKey) || 0) + 1);
        });

        const loops = [];

        for (const [startKey, node] of nodes.entries()) {
            for (const neighborKey of node.neighbors) {
                const eKey = edgeKey(startKey, neighborKey);
                if (!edgeUse.get(eKey)) continue;

                const path = [];
                let currentKey = startKey;
                let prevKey = null;

                while (true) {
                    const currentNode = nodes.get(currentKey);
                    path.push(currentNode.point);

                    let nextKey = null;
                    for (const candidate of currentNode.neighbors) {
                        const candidateKey = edgeKey(currentKey, candidate);
                        if (!edgeUse.get(candidateKey)) continue;
                        if (candidate === prevKey) continue;
                        nextKey = candidate;
                        break;
                    }

                    if (!nextKey) {
                        for (const candidate of currentNode.neighbors) {
                            const candidateKey = edgeKey(currentKey, candidate);
                            if (edgeUse.get(candidateKey)) {
                                nextKey = candidate;
                                break;
                            }
                        }
                    }

                    if (!nextKey) break;

                    const usedKey = edgeKey(currentKey, nextKey);
                    edgeUse.set(usedKey, edgeUse.get(usedKey) - 1);

                    prevKey = currentKey;
                    currentKey = nextKey;

                    if (currentKey === startKey) {
                        break;
                    }
                }

                if (path.length >= 3) {
                    loops.push(path);
                }
            }
        }

        if (loops.length === 0) return [];

        let bestLoop = null;
        let bestArea = 0;
        loops.forEach(loop => {
            const normalized = loop.map(pt => ({
                x: pt.x / width,
                y: pt.y / height
            }));
            const area = Math.abs(this.polygonArea(normalized));
            if (area > bestArea) {
                bestArea = area;
                bestLoop = normalized;
            }
        });

        return bestLoop || [];
    }

    traceOutline(data, width, height) {
        const points = [];
        const threshold = 128;

        // Simple edge detection - find boundary pixels
        for (let y = 0; y < height; y += 3) {
            for (let x = 0; x < width; x += 3) {
                const idx = (y * width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                if (brightness < threshold) {
                    // Check if it's an edge pixel (has a white neighbor)
                    let isEdge = false;
                    for (let dy = -1; dy <= 1 && !isEdge; dy++) {
                        for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nidx = (ny * width + nx) * 4;
                                const nBrightness = (data[nidx] + data[nidx + 1] + data[nidx + 2]) / 3;
                                if (nBrightness >= threshold) {
                                    isEdge = true;
                                }
                            }
                        }
                    }

                    if (isEdge) {
                        points.push({ x: x / width, y: y / height });
                    }
                }
            }
        }

        // Sort points to form a continuous outline (convex hull approach)
        return this.orderPointsClockwise(points);
    }

    orderPointsClockwise(points) {
        if (points.length < 3) return points;

        // Find centroid
        const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // Sort by angle from centroid
        return points.sort((a, b) => {
            const angleA = Math.atan2(a.y - cy, a.x - cx);
            const angleB = Math.atan2(b.y - cy, b.x - cx);
            return angleA - angleB;
        });
    }

    simplifyPath(points, tolerance) {
        // Douglas-Peucker algorithm for path simplification
        if (points.length <= 2) return points;

        // Find the point with maximum distance from line between first and last
        let maxDist = 0;
        let maxIndex = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], start, end);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        // If max distance is greater than tolerance, recursively simplify
        if (maxDist > tolerance) {
            const left = this.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        }

        return [start, end];
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
        return Math.abs((point.y - lineStart.y) * dx - (point.x - lineStart.x) * dy) / d;
    }

    updatePieceList() {
        const list = document.getElementById('pieceList');
        const count = document.getElementById('pieceCount');
        count.textContent = this.pieces.length;

        if (this.pieces.length === 0) {
            list.innerHTML = `<div style="color: #666; font-size: 0.85rem; padding: 20px; text-align: center;">
                No pieces yet. Use the Draw tool to create pieces.
            </div>`;
            return;
        }

        list.innerHTML = this.pieces.map((piece, index) => `
            <div class="piece-item ${index === this.selectedPieceIndex ? 'selected' : ''}" data-index="${index}">
                <div class="piece-color" style="background: ${piece.color}"></div>
                <span class="piece-name">${piece.id} (${piece.vertices.length} pts)</span>
                <span class="piece-delete" data-delete="${index}">&times;</span>
            </div>
        `).join('');

        // Add click handlers
        list.querySelectorAll('.piece-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('piece-delete')) {
                    this.selectedPieceIndex = parseInt(item.dataset.index);
                    this.updatePieceList();
                    this.render();
                }
            });
        });

        list.querySelectorAll('.piece-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.delete);
                this.pieces.splice(index, 1);
                this.selectedPieceIndex = -1;
                this.updatePieceList();
                this.render();
            });
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw background
        this.ctx.fillStyle = '#2a2a3e';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw image
        if (this.image) {
            const scaledWidth = this.image.width * this.imageScale;
            const scaledHeight = this.image.height * this.imageScale;
            this.ctx.globalAlpha = this.showFullImage ? 1 : 0.3;
            this.ctx.drawImage(this.image, this.imageOffsetX, this.imageOffsetY, scaledWidth, scaledHeight);
            this.ctx.globalAlpha = 1;
        }

        // Draw silhouette
        if (this.silhouette.length > 2) {
            this.ctx.beginPath();
            const first = this.normalizedToCanvas(this.silhouette[0].x, this.silhouette[0].y);
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.silhouette.length; i++) {
                const p = this.normalizedToCanvas(this.silhouette[i].x, this.silhouette[i].y);
                this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Draw pieces (either in place or scattered based on preview mode)
        this.pieces.forEach((piece, index) => {
            if (this.showScattered) {
                // Draw at scattered start positions (preview how they'll look in game)
                const offsetVertices = this.offsetVertices(piece.vertices, piece.startPos);
                this.drawPolygon(offsetVertices, piece.color, index === this.selectedPieceIndex);
            } else {
                // Draw in place (editing mode)
                this.drawPolygon(piece.vertices, piece.color, index === this.selectedPieceIndex);
            }
        });

        // Draw current piece being drawn
        if (this.currentPiece.length > 0) {
            this.ctx.beginPath();
            const first = this.normalizedToCanvas(this.currentPiece[0].x, this.currentPiece[0].y);
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.currentPiece.length; i++) {
                const p = this.normalizedToCanvas(this.currentPiece[i].x, this.currentPiece[i].y);
                this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw points
            this.currentPiece.forEach(point => {
                const p = this.normalizedToCanvas(point.x, point.y);
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                this.ctx.fillStyle = this.currentColor;
                this.ctx.fill();
            });
        }
    }

    // Offset vertices to a new center position (for scatter preview)
    offsetVertices(vertices, newCenter) {
        // Calculate current center
        const minX = Math.min(...vertices.map(v => v.x));
        const maxX = Math.max(...vertices.map(v => v.x));
        const minY = Math.min(...vertices.map(v => v.y));
        const maxY = Math.max(...vertices.map(v => v.y));
        const currentCenter = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };

        // Calculate offset
        const dx = newCenter.x - currentCenter.x;
        const dy = newCenter.y - currentCenter.y;

        // Apply offset to all vertices
        return vertices.map(v => ({
            x: v.x + dx,
            y: v.y + dy
        }));
    }

    drawPolygon(vertices, color, selected = false) {
        if (vertices.length < 3) return;

        this.ctx.beginPath();
        const first = this.normalizedToCanvas(vertices[0].x, vertices[0].y);
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < vertices.length; i++) {
            const p = this.normalizedToCanvas(vertices[i].x, vertices[i].y);
            this.ctx.lineTo(p.x, p.y);
        }
        this.ctx.closePath();

        // Fill
        this.ctx.fillStyle = color + '88'; // Add transparency
        this.ctx.fill();

        // Stroke
        this.ctx.strokeStyle = selected ? '#fff' : color;
        this.ctx.lineWidth = selected ? 3 : 2;
        this.ctx.stroke();
    }

    generateJson() {
        const levelId = document.getElementById('levelId').value || 'level_016';
        const worldId = parseInt(document.getElementById('worldId').value);
        const difficulty = document.getElementById('difficulty').value;
        const imageMode = document.getElementById('imageMode').checked;

        // Use silhouette if traced, otherwise use combined pieces outline
        let silhouettePoints = this.silhouette;
        if (silhouettePoints.length === 0 && this.pieces.length > 0) {
            // Combine all piece vertices for silhouette approximation
            silhouettePoints = this.pieces.flatMap(p => p.vertices);
            silhouettePoints = this.orderPointsClockwise(silhouettePoints);
        }

        // Build metadata
        const metadata = {
            world: worldId,
            levelNumber: parseInt(levelId.replace('level_', '')),
            difficulty: difficulty,
            theme: worldId === 2 ? "nature_warm" : "pastel_blue"
        };

        // Add imageName if in image mode
        if (imageMode && this.image) {
            // Use levelId as image name (user must add image to Xcode assets)
            metadata.imageName = levelId;
        }

        // Build pieces array
        const pieces = this.pieces.map(piece => {
            const pieceData = {
                id: piece.id,
                vertices: piece.vertices.map(v => [
                    parseFloat(v.x.toFixed(3)),
                    parseFloat(v.y.toFixed(3))
                ]),
                startPos: [
                    parseFloat(piece.startPos.x.toFixed(3)),
                    parseFloat(piece.startPos.y.toFixed(3))
                ],
                startRotation: 0,
                correctPos: [
                    parseFloat(this.calculateCenter(piece.vertices).x.toFixed(3)),
                    parseFloat(this.calculateCenter(piece.vertices).y.toFixed(3))
                ],
                correctRotation: 0
            };

            // Add imageRect for image-based pieces
            if (imageMode && this.image) {
                const minX = Math.min(...piece.vertices.map(v => v.x));
                const maxX = Math.max(...piece.vertices.map(v => v.x));
                const minY = Math.min(...piece.vertices.map(v => v.y));
                const maxY = Math.max(...piece.vertices.map(v => v.y));

                pieceData.imageRect = [
                    parseFloat(minX.toFixed(3)),
                    parseFloat(minY.toFixed(3)),
                    parseFloat((maxX - minX).toFixed(3)),
                    parseFloat((maxY - minY).toFixed(3))
                ];
            }

            return pieceData;
        });

        const json = {
            version: "1.0",
            id: levelId,
            metadata: metadata,
            silhouette: {
                type: "polygon",
                points: silhouettePoints.map(p => [
                    parseFloat(p.x.toFixed(3)),
                    parseFloat(p.y.toFixed(3))
                ])
            },
            pieces: pieces,
            winConditions: {
                requiredCoverage: 0.95,
                snapThreshold: 0.05
            }
        };

        return JSON.stringify(json, null, 2);
    }

    showExportModal() {
        const json = this.generateJson();
        document.getElementById('jsonOutput').textContent = json;
        document.getElementById('exportModal').classList.add('active');
    }

    copyToClipboard() {
        const json = this.generateJson();
        navigator.clipboard.writeText(json).then(() => {
            alert('JSON copied to clipboard!');
        });
    }

    downloadJson() {
        const json = this.generateJson();
        const levelId = document.getElementById('levelId').value || 'level_016';
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${levelId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new LevelEditor();
});
