document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvasContainer = document.getElementById('canvas-container');
    const canvasElement = document.getElementById('canvas');
    const toolbarButtons = {
        select: document.getElementById('select-tool'),
        draw: document.getElementById('draw-tool'),
        text: document.getElementById('text-tool'),
        image: document.getElementById('image-upload'),
        link: document.getElementById('link-tool'),
        delete: document.getElementById('delete-tool'),
    };
    const historyButtons = {
        undo: document.getElementById('undo-button'),
        redo: document.getElementById('redo-button'),
    };
    const colorPicker = document.getElementById('color-picker');
    const lineWidth = document.getElementById('line-width');
    const pageControls = {
        prev: document.getElementById('prev-page'),
        next: document.getElementById('next-page'),
        add: document.getElementById('add-page'),
        delete: document.getElementById('delete-page'),
        indicator: document.getElementById('page-indicator'),
    };

    // App State
    let pages = [null];
    let currentPageIndex = 0;
    let currentTool = 'select';
    
    // History State (per page)
    let history = [];
    let redoStack = [];
    let historyLock = false; // Prevents saving state during undo/redo

    // Initialize Fabric.js Canvas
    const fabricCanvas = new fabric.Canvas(canvasElement, {
        isDrawingMode: false,
        backgroundColor: '#fff',
    });

    // --- Mobile/Touch Optimizations ---
    if ('ontouchstart' in window) {
        fabric.Object.prototype.set({
            cornerSize: 15, // Visual size of the corner
            touchCornerSize: 44, // Larger touch area for easier interaction
            transparentCorners: true, // Don't fill the area between corner and object
            cornerColor: 'rgba(0,123,255,0.7)',
            borderColor: 'rgba(0,123,255,0.7)',
            cornerStyle: 'circle'
        });
    }

    // --- Canvas Sizing ---
    const resizeCanvas = () => {
        const containerWidth = canvasContainer.clientWidth;
        const containerHeight = canvasContainer.clientHeight;
        fabricCanvas.setWidth(containerWidth);
        fabricCanvas.setHeight(containerHeight);
        fabricCanvas.renderAll();
    };
    window.addEventListener('resize', resizeCanvas);
    

    // --- Pan and Zoom ---
    let isPanning = false;
    let panMode = 'none'; // 'mouse' or 'touch'
    let lastPosX, lastPosY;

    // --- Mouse Wheel Zoom (Desktop) ---
    fabricCanvas.on('mouse:wheel', function(opt) {
        if (!opt.e.altKey) return;
        const delta = opt.e.deltaY;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20; // Max zoom
        if (zoom < 0.01) zoom = 0.01; // Min zoom
        fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // --- Pinch-to-Zoom (Touch) ---
    fabricCanvas.on('touch:gesture', function(opt) {
        if (opt.e.touches && opt.e.touches.length === 2) {
            isPanning = false; // Stop panning if a zoom gesture starts
            const point = new fabric.Point(opt.self.x, opt.self.y);
            let zoom = fabricCanvas.getZoom();
            zoom *= opt.self.scale;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            fabricCanvas.zoomToPoint(point, zoom);
        }
    });

    // --- Panning Move ---
    fabricCanvas.on('mouse:move', function(opt) {
        const e = opt.e;

        // Check if we should START touch panning
        if (!isPanning && e.touches && e.touches.length === 2) {
            if (fabricCanvas.isDrawingMode) {
                fabricCanvas.isDrawingMode = false; // Prevent stray lines
            }
            isPanning = true;
            panMode = 'touch';
            fabricCanvas.discardActiveObject().renderAll();
            fabricCanvas.selection = false;
            lastPosX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastPosY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            return;
        }

        if (isPanning) {
            const vpt = this.viewportTransform;
            let currentX, currentY;

            if (panMode === 'touch') {
                if (!e.touches || e.touches.length < 2) return;
                currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            } else { // panMode === 'mouse'
                currentX = e.clientX;
                currentY = e.clientY;
            }

            vpt[4] += currentX - lastPosX;
            vpt[5] += currentY - lastPosY;
            this.requestRenderAll();
            lastPosX = currentX;
            lastPosY = currentY;
        }
    });

    resizeCanvas();

    // --- History Management ---
    const saveState = () => {
        if (historyLock) return;
        redoStack = []; // Clear redo stack on new action
        history.push(fabricCanvas.toJSON(['isLink', 'url']));
        updateHistoryButtons();
    };

    const updateHistoryButtons = () => {
        historyButtons.undo.disabled = history.length <= 1;
        historyButtons.redo.disabled = redoStack.length === 0;
    };
    
    const resetHistory = (initialState = null) => {
        const state = initialState || fabricCanvas.toJSON(['isLink', 'url']);
        history = [state];
        redoStack = [];
        updateHistoryButtons();
    };

    historyButtons.undo.addEventListener('click', () => {
        if (history.length > 1) {
            historyLock = true;
            redoStack.push(history.pop());
            const prevState = history[history.length - 1];
            fabricCanvas.loadFromJSON(prevState, () => {
                fabricCanvas.renderAll();
                historyLock = false;
                updateHistoryButtons();
            });
        }
    });

    historyButtons.redo.addEventListener('click', () => {
        if (redoStack.length > 0) {
            historyLock = true;
            const nextState = redoStack.pop();
            history.push(nextState);
            fabricCanvas.loadFromJSON(nextState, () => {
                fabricCanvas.renderAll();
                historyLock = false;
                updateHistoryButtons();
            });
        }
    });

    // --- State Management ---
    const saveCurrentPage = () => {
        pages[currentPageIndex] = fabricCanvas.toJSON(['isLink', 'url']);
    };

    const loadPage = (pageIndex) => {
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        currentPageIndex = pageIndex;
        const pageData = pages[currentPageIndex];

        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#fff';

        if (pageData) {
            fabricCanvas.loadFromJSON(pageData, () => {
                fabricCanvas.renderAll();
                resetHistory(pageData);
            });
        } else {
            fabricCanvas.renderAll();
            resetHistory();
        }
        updatePageIndicator();
    };
    
    const saveToLocalStorage = () => {
        saveCurrentPage();
        localStorage.setItem('gMemoPages', JSON.stringify(pages));
    };

    const loadFromLocalStorage = () => {
        const savedPages = localStorage.getItem('gMemoPages');
        if (savedPages) {
            pages = JSON.parse(savedPages);
            if (!Array.isArray(pages) || pages.length === 0) pages = [null];
        }
        loadPage(0);
    };

    const updatePageIndicator = () => {
        pageControls.indicator.textContent = `Страница ${currentPageIndex + 1} / ${pages.length}`;
    };

    // --- Tool Implementation ---
    const setActiveTool = (tool) => {
        currentTool = tool;
        fabricCanvas.isDrawingMode = tool === 'draw';
        Object.values(toolbarButtons).forEach(btn => btn.classList.remove('active'));
        const activeButton = document.getElementById(`${tool}-tool`);
        if (activeButton) activeButton.classList.add('active');
    };

    Object.keys(toolbarButtons).forEach(key => {
        const btn = toolbarButtons[key];
        if(btn.id !== 'image-upload') { // Image upload is a label/input pair
            btn.addEventListener('click', () => setActiveTool(key));
        }
    });

    colorPicker.addEventListener('input', () => {
        fabricCanvas.freeDrawingBrush.color = colorPicker.value;
    });
    lineWidth.addEventListener('input', () => {
        fabricCanvas.freeDrawingBrush.width = parseInt(lineWidth.value, 10);
    });
    fabricCanvas.freeDrawingBrush.color = colorPicker.value;
    fabricCanvas.freeDrawingBrush.width = parseInt(lineWidth.value, 10);

    toolbarButtons.image.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                img.scaleToWidth(200);
                fabricCanvas.add(img);
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });

    toolbarButtons.link.addEventListener('click', () => {
        const url = prompt("Введите URL ссылки:", "https://");
        if (!url) return;
        const text = prompt("Введите текст для ссылки:", "Моя ссылка");
        if (!text) return;
        const linkText = new fabric.IText(text, {
            left: 150, top: 150, fontSize: 24, fill: '#007bff', underline: true, fontFamily: 'Arial', isLink: true, url: url
        });
        fabricCanvas.add(linkText);
    });

    toolbarButtons.delete.addEventListener('click', () => {
        fabricCanvas.getActiveObjects().forEach(obj => fabricCanvas.remove(obj));
        fabricCanvas.discardActiveObject().renderAll();
    });
    
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && !fabricCanvas.getActiveObject()?.isEditing) {
            toolbarButtons.delete.click();
        }
    });

    // --- Text Tool: Create text on tap & Panning Start ---
    fabricCanvas.on('mouse:down', function(opt) {
        // Handle text tool logic
        if (currentTool === 'text' && !opt.target && !isPanning) {
            const pointer = fabricCanvas.getPointer(opt.e);
            const text = new fabric.IText('Текст', {
                left: pointer.x,
                top: pointer.y,
                fill: colorPicker.value,
                fontSize: 24,
                fontFamily: 'Arial',
                originX: 'center',
                originY: 'center'
            });
            fabricCanvas.add(text);
            fabricCanvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            
            setActiveTool('select'); // Switch back to select tool
            return; // Stop further processing
        }

        // Handle panning start for mouse
        const e = opt.e;
        if (e.altKey) {
            isPanning = true;
            panMode = 'mouse';
            fabricCanvas.selection = false;
            lastPosX = e.clientX;
            lastPosY = e.clientY;
            fabricCanvas.setCursor('grabbing');
        }
    });

    // --- Panning End & Link Click ---
    fabricCanvas.on('mouse:up', function(opt) {
        // End Panning
        if (isPanning) {
            this.setViewportTransform(this.viewportTransform);
            if (panMode === 'touch' && currentTool === 'draw') {
                fabricCanvas.isDrawingMode = true; // Re-enable drawing
            }
            isPanning = false;
            panMode = 'none';
            fabricCanvas.selection = true;
            fabricCanvas.setCursor('default');
        }
        // Handle Link Clicks
        else if (opt.target && opt.target.isLink && !opt.target.isEditing) {
            // Use a small timeout to distinguish from double-click
            setTimeout(() => {
                if (fabricCanvas.getActiveObject() === opt.target) {
                     window.open(opt.target.url, '_blank');
                }
            }, 200);
        }
    });

    // --- Canvas Events ---
    fabricCanvas.on({
        'object:added': saveState,
        'object:removed': saveState,
        'object:modified': saveState,
    });

    fabricCanvas.on('mouse:dblclick', (options) => {
        if (options.target) {
            if (options.target.isLink) {
                const target = options.target;
                const newText = prompt("Измените текст ссылки:", target.text);
                if (newText !== null) target.set('text', newText);
                const newUrl = prompt("Измените URL:", target.url);
                if (newUrl !== null) target.set('url', newUrl);
                fabricCanvas.renderAll();
            } else if (options.target.type === 'i-text') {
                const target = options.target;
                target.enterEditing();
                
                // Manually implement word selection for better touch support
                const selectionStart = target.getSelectionStartFromPointer(options.e);
                const start = target.findWordBoundaryLeft(selectionStart);
                const end = target.findWordBoundaryRight(selectionStart);

                target.setSelectionStart(start);
                target.setSelectionEnd(end);
                fabricCanvas.renderAll(); // Re-render to show selection
            }
        }
    });

    // --- Page Navigation ---
    pageControls.prev.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            saveCurrentPage();
            loadPage(currentPageIndex - 1);
        }
    });

    pageControls.next.addEventListener('click', () => {
        if (currentPageIndex < pages.length - 1) {
            saveCurrentPage();
            loadPage(currentPageIndex + 1);
        }
    });

    pageControls.add.addEventListener('click', () => {
        saveCurrentPage();
        pages.push(null);
        loadPage(pages.length - 1);
    });

    pageControls.delete.addEventListener('click', () => {
        if (pages.length <= 1) {
            alert("Нельзя удалить последнюю страницу.");
            return;
        }
        if (confirm("Вы уверены, что хотите удалить эту страницу?")) {
            pages.splice(currentPageIndex, 1);
            if (currentPageIndex >= pages.length) {
                currentPageIndex = pages.length - 1;
            }
            loadPage(currentPageIndex);
        }
    });

    // --- Final Setup ---
    setActiveTool('select');
    loadFromLocalStorage();
    window.addEventListener('beforeunload', saveToLocalStorage);
});
