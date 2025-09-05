document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvasContainer = document.getElementById('canvas-container');
    const canvasElement = document.getElementById('canvas');
    
    // --- Toolbar & Controls ---
    // We select controls by data-attributes or classes to support both mobile and desktop toolbars
    const toolButtons = document.querySelectorAll('[data-tool]');
    const colorPickers = document.querySelectorAll('.color-picker-input');
    const lineWidthSliders = document.querySelectorAll('.line-width-slider');
    const imageUploadInputs = document.querySelectorAll('.image-upload-input');

    const historyButtons = {
        undo: document.getElementById('undo-button'),
        redo: document.getElementById('redo-button'),
    };
    const importExportButtons = {
        export: document.getElementById('export-button'),
        importInput: document.getElementById('import-input'),
    };
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
    let historyLock = false;

    // Initialize Fabric.js Canvas
    const fabricCanvas = new fabric.Canvas(canvasElement, {
        isDrawingMode: false,
        backgroundColor: '#fff',
    });

    // --- Mobile/Touch Optimizations ---
    if ('ontouchstart' in window) {
        fabric.Object.prototype.set({
            cornerSize: 15,
            touchCornerSize: 44,
            transparentCorners: true,
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
    let panMode = 'none';
    let lastPosX, lastPosY;

    fabricCanvas.on('mouse:wheel', function(opt) {
        if (!opt.e.altKey) return;
        const delta = opt.e.deltaY;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    fabricCanvas.on('touch:gesture', function(opt) {
        if (opt.e.touches && opt.e.touches.length === 2) {
            isPanning = false;
            const point = new fabric.Point(opt.self.x, opt.self.y);
            let zoom = fabricCanvas.getZoom();
            zoom *= opt.self.scale;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            fabricCanvas.zoomToPoint(point, zoom);
        }
    });

    fabricCanvas.on('mouse:move', function(opt) {
        const e = opt.e;
        if (!isPanning && e.touches && e.touches.length === 2) {
            if (fabricCanvas.isDrawingMode) fabricCanvas.isDrawingMode = false;
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
            } else {
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
        redoStack = [];
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
    const saveCurrentPage = () => pages[currentPageIndex] = fabricCanvas.toJSON(['isLink', 'url']);

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
        pageControls.indicator.textContent = `Стр. ${currentPageIndex + 1} / ${pages.length}`;
    };

    // --- Tool Implementation ---
    const setActiveTool = (tool) => {
        currentTool = tool;
        fabricCanvas.isDrawingMode = tool === 'draw';
        toolButtons.forEach(btn => {
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };

    toolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tool = e.currentTarget.dataset.tool;
            if (tool) {
                if (tool === 'delete') {
                    fabricCanvas.getActiveObjects().forEach(obj => fabricCanvas.remove(obj));
                    fabricCanvas.discardActiveObject().renderAll();
                } else if (tool === 'link') {
                    const url = prompt("Введите URL ссылки:", "https://");
                    if (!url) return;
                    const text = prompt("Введите текст для ссылки:", "Моя ссылка");
                    if (!text) return;
                    const linkText = new fabric.IText(text, {
                        left: 150, top: 150, fontSize: 24, fill: '#007bff', underline: true, fontFamily: 'Arial', isLink: true, url: url
                    });
                    fabricCanvas.add(linkText);
                } else {
                    setActiveTool(tool);
                }
            }
        });
    });

    colorPickers.forEach(picker => {
        picker.addEventListener('input', (e) => {
            const newColor = e.target.value;
            fabricCanvas.freeDrawingBrush.color = newColor;
            // Sync other color pickers
            colorPickers.forEach(p => p.value = newColor);
        });
    });

    lineWidthSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const newWidth = parseInt(e.target.value, 10);
            fabricCanvas.freeDrawingBrush.width = newWidth;
            // Sync other sliders
            lineWidthSliders.forEach(s => s.value = newWidth);
        });
    });

    imageUploadInputs.forEach(input => {
        input.addEventListener('change', (e) => {
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
            e.target.value = ''; // Reset for next upload
        });
    });
    
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && !fabricCanvas.getActiveObject()?.isEditing) {
            document.querySelector('[data-tool="delete"]').click();
        }
    });

    // --- Canvas Events ---
    fabricCanvas.on('mouse:down', function(opt) {
        if (currentTool === 'text' && !opt.target && !isPanning) {
            const pointer = fabricCanvas.getPointer(opt.e);
            const text = new fabric.IText('Текст', {
                left: pointer.x, top: pointer.y, fill: colorPickers[0].value, fontSize: 24, fontFamily: 'Arial', originX: 'center', originY: 'center'
            });
            fabricCanvas.add(text);
            fabricCanvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            setActiveTool('select');
            return;
        }
        if (opt.e.altKey) {
            isPanning = true;
            panMode = 'mouse';
            fabricCanvas.selection = false;
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
            fabricCanvas.setCursor('grabbing');
        }
    });

    fabricCanvas.on('mouse:up', function(opt) {
        if (isPanning) {
            this.setViewportTransform(this.viewportTransform);
            if (panMode === 'touch' && currentTool === 'draw') fabricCanvas.isDrawingMode = true;
            isPanning = false;
            panMode = 'none';
            fabricCanvas.selection = true;
            fabricCanvas.setCursor('default');
        } else if (opt.target && opt.target.isLink && !opt.target.isEditing) {
            setTimeout(() => {
                if (fabricCanvas.getActiveObject() === opt.target) window.open(opt.target.url, '_blank');
            }, 200);
        }
    });

    fabricCanvas.on({ 'object:added': saveState, 'object:removed': saveState, 'object:modified': saveState });

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
                const selectionStart = target.getSelectionStartFromPointer(options.e);
                const start = target.findWordBoundaryLeft(selectionStart);
                const end = target.findWordBoundaryRight(selectionStart);
                target.setSelectionStart(start);
                target.setSelectionEnd(end);
                fabricCanvas.renderAll();
            }
        }
    });

    // --- Page Navigation ---
    pageControls.prev.addEventListener('click', () => { if (currentPageIndex > 0) { saveCurrentPage(); loadPage(currentPageIndex - 1); } });
    pageControls.next.addEventListener('click', () => { if (currentPageIndex < pages.length - 1) { saveCurrentPage(); loadPage(currentPageIndex + 1); } });
    pageControls.add.addEventListener('click', () => { saveCurrentPage(); pages.push(null); loadPage(pages.length - 1); });
    pageControls.delete.addEventListener('click', () => {
        if (pages.length <= 1) { alert("Нельзя удалить последнюю страницу."); return; }
        if (confirm("Вы уверены, что хотите удалить эту страницу?")) {
            pages.splice(currentPageIndex, 1);
            if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
            loadPage(currentPageIndex);
        }
    });

    // --- Import/Export ---
    const exportNotes = () => {
        saveCurrentPage(); // Ensure the very latest changes are saved
        const dataStr = JSON.stringify(pages);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gMemo_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importNotes = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedPages = JSON.parse(event.target.result);
                if (Array.isArray(importedPages)) {
                    if (confirm("Импорт заменит все текущие заметки. Продолжить?")) {
                        pages = importedPages;
                        loadPage(0);
                        saveToLocalStorage();
                    }
                } else {
                    throw new Error("Invalid file format");
                }
            } catch (error) {
                alert("Не удалось импортировать файл. Убедитесь, что это правильный файл экспорта gMemo.");
                console.error("Import error:", error);
            } finally {
                // Reset file input to allow importing the same file again
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    importExportButtons.export.addEventListener('click', exportNotes);
    importExportButtons.importInput.addEventListener('change', importNotes);


    // --- Final Setup ---
    setActiveTool('select');
    loadFromLocalStorage();
    fabricCanvas.freeDrawingBrush.color = colorPickers[0].value;
    fabricCanvas.freeDrawingBrush.width = parseInt(lineWidthSliders[0].value, 10);
    window.addEventListener('beforeunload', saveToLocalStorage);
});