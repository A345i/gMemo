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
    let isCanvasDragging = false;
    let lastPosX, lastPosY;

    // --- Desktop: Mouse Wheel Zoom (Alt + Scroll) ---
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

    // --- Touch: Pinch-to-Zoom ---
    fabricCanvas.on('touch:gesture', function(opt) {
        if (opt.e.touches && opt.e.touches.length === 2) {
            isCanvasDragging = false; // Prevent panning during zoom
            const point = new fabric.Point(opt.self.x, opt.self.y);
            let zoom = fabricCanvas.getZoom();
            zoom *= opt.self.scale;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            fabricCanvas.zoomToPoint(point, zoom);
        }
    });

    // --- Desktop (Alt + Drag) & Touch (Two-finger Drag) Panning ---
    fabricCanvas.on('mouse:down', function(opt) {
        const e = opt.e;
        // Start panning if Alt key is pressed OR it's a two-finger touch
        if (e.altKey || (e.touches && e.touches.length === 2)) {
            isCanvasDragging = true;
            fabricCanvas.selection = false; // Disable object selection while panning
            const point = e.touches ? e.touches[0] : e;
            lastPosX = point.clientX;
            lastPosY = point.clientY;
            if (e.altKey) fabricCanvas.setCursor('grabbing');
        }
    });

    fabricCanvas.on('mouse:move', function(opt) {
        if (!isCanvasDragging) return;
        const e = opt.e;
        const point = e.touches ? e.touches[0] : e;
        const vpt = this.viewportTransform;
        vpt[4] += point.clientX - lastPosX;
        vpt[5] += point.clientY - lastPosY;
        this.requestRenderAll();
        lastPosX = point.clientX;
        lastPosY = point.clientY;
    });

    fabricCanvas.on('mouse:up', function(opt) {
        if (isCanvasDragging) {
            this.setViewportTransform(this.viewportTransform);
            isCanvasDragging = false;
            fabricCanvas.selection = true; // Re-enable object selection
            fabricCanvas.setCursor('default');
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

    toolbarButtons.text.addEventListener('click', () => {
        const text = new fabric.IText('Введите текст...', {
            left: 100, top: 100, fill: colorPicker.value, fontSize: 24, fontFamily: 'Arial'
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setActiveTool('select');
    });

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
                options.target.enterEditing();
            }
        }
    });

    fabricCanvas.on('mouse:up', (options) => {
        if (options.target && options.target.isLink && !options.target.isEditing) {
            setTimeout(() => {
                if (fabricCanvas.getActiveObject() === options.target) {
                     window.open(options.target.url, '_blank');
                }
            }, 200);
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