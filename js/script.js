document.addEventListener('DOMContentLoaded', () => {
    try {
        // --- Supabase Setup ---
        const SUPABASE_URL = 'https://mrwzsslileqnamzztrfc.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3pzc2xpbGVxbmFtenp0cmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMTUxODYsImV4cCI6MjA3MTU5MTE4Nn0.zwqdtbhId00P93w2lGcwV-EHTF11A4Db9IEQbJ8FSUQ';
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // --- DOM Elements ---
        const loadingOverlay = document.getElementById('loading-overlay');
        const authContainer = document.getElementById('auth-container');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const authError = document.getElementById('auth-error');
        const appContainer = document.getElementById('app-container');
        const userEmailDisplay = document.getElementById('user-email-display');
        const logoutButton = document.getElementById('logout-button');
        const canvasContainer = document.getElementById('canvas-container');
        const canvasElement = document.getElementById('canvas');
        const toolButtons = document.querySelectorAll('[data-tool]');
        const colorPickers = document.querySelectorAll('.color-picker-input');
        const lineWidthSliders = document.querySelectorAll('.line-width-slider');
        const lineWidthValues = {
            desktop: document.getElementById('line-width-value-desktop'),
            mobile: document.getElementById('line-width-value-mobile')
        };
        const imageUploadInputs = document.querySelectorAll('.image-upload-input');
        const historyButtons = { 
            undo: document.getElementById('undo-button'), 
            redo: document.getElementById('redo-button'),
            mobileUndo: document.getElementById('mobile-undo-button'),
            mobileRedo: document.getElementById('mobile-redo-button'),
            showAll: document.getElementById('show-all-button')
        };
        const pageControls = { 
            prev: document.getElementById('prev-page'), 
            next: document.getElementById('next-page'), 
            add: document.getElementById('add-page'), 
            delete: document.getElementById('delete-page'), 
            indicator: document.getElementById('page-indicator'),
            export: document.getElementById('export-button')
        };
        
        // --- Mobile Draw Options Elements ---
        const mobileDrawOptions = document.getElementById('mobile-draw-options');
        const widthIncreaseBtn = document.getElementById('width-increase-mobile');
        const widthDecreaseBtn = document.getElementById('width-decrease-mobile');


        // --- App State ---
        let pages = [null];
        let currentPageIndex = 0;
        let currentTool = 'select';
        let history = [];
        let redoStack = [];
        let historyLock = false;
        let currentUser = null;
        let dataLoaded = false;

        // --- UI State Functions ---
        const showLoader = () => loadingOverlay.classList.remove('d-none');
        const hideLoader = () => loadingOverlay.classList.add('d-none');

        // --- Fabric.js Canvas Initialization ---
        const fabricCanvas = new fabric.Canvas(canvasElement, { isDrawingMode: false, backgroundColor: '#fff' });
        
        // Sync initial brush settings with UI defaults
        const initialLineWidth = parseInt(lineWidthSliders[0].value, 10);
        const initialColor = colorPickers[0].value;
        fabricCanvas.freeDrawingBrush.width = initialLineWidth;
        fabricCanvas.freeDrawingBrush.color = initialColor;
        fabricCanvas.freeDrawingBrush.width = initialLineWidth;
        fabricCanvas.freeDrawingBrush.color = initialColor;

        // --- Marker Color Logic ---
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
        };

        const invertColor = (rgb) => ({ r: 255 - rgb.r, g: 255 - rgb.g, b: 255 - rgb.b });

        const rgbToRgba = (rgb, alpha) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

        const updateBrushSettings = () => {
            const pencilWidth = parseInt(lineWidthSliders[0].value, 10);
            const pencilColor = colorPickers[0].value;
            const brush = fabricCanvas.freeDrawingBrush;

            // --- Final, Simplified Logic ---
            // Always use the standard drawing mode.
            brush.globalCompositeOperation = 'source-over';

            switch (currentTool) {
                case 'draw':
                    brush.width = pencilWidth;
                    brush.color = pencilColor;
                    break;

                case 'marker':
                    const rgbColor = hexToRgb(pencilColor);
                    if (rgbColor) {
                        const invertedRgb = invertColor(rgbColor);
                        brush.color = rgbToRgba(invertedRgb, 0.3);
                    }
                    brush.width = pencilWidth * 3;
                    break;
            }
        };
        
        // --- Auth Functions ---
        const showError = (message) => { authError.textContent = message; authError.classList.remove('d-none'); };
        const hideError = () => { authError.classList.add('d-none'); };

        loginForm.addEventListener('submit', async (e) => { e.preventDefault(); hideError(); showLoader(); const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) { showError(error.message); hideLoader(); } });
        registerForm.addEventListener('submit', async (e) => { e.preventDefault(); hideError(); showLoader(); const email = document.getElementById('register-email').value; const password = document.getElementById('register-password').value; const username = document.getElementById('register-username').value; const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { username: username } } }); hideLoader(); if (error) { showError(error.message); } else { alert('Регистрация успешна! Пожалуйста, подтвердите свой email.'); new bootstrap.Tab(document.getElementById('pills-login-tab')).show(); } });
        logoutButton.addEventListener('click', async () => { showLoader(); await saveNotesToSupabase(); await supabaseClient.auth.signOut(); });

        // --- Supabase Data Functions ---
        const loadNotesFromSupabase = async () => {
            dataLoaded = false;
            const { data, error } = await supabaseClient.from('profiles').select('profile_text').single();
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching notes:', error);
            } else if (data && data.profile_text) {
                try {
                    const savedData = JSON.parse(data.profile_text);
                    // Handle both old format (array of pages) and new format (object with pages and currentPageIndex)
                    if (Array.isArray(savedData)) {
                        // Old format - only pages array
                        pages = savedData;
                        loadPage(0); // Default to first page for old data
                    } else if (savedData && typeof savedData === 'object') {
                        // New format - object with pages and currentPageIndex
                        if (Array.isArray(savedData.pages)) {
                            pages = savedData.pages;
                        }
                        const savedCurrentPageIndex = savedData.currentPageIndex || 0;
                        // Validate that the saved index is within bounds
                        if (savedCurrentPageIndex >= pages.length) {
                            loadPage(Math.max(0, pages.length - 1));
                        } else {
                            loadPage(savedCurrentPageIndex);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing saved notes JSON:', e);
                }
            } else {
                loadPage(0);
            }
            dataLoaded = true;
        };

        const saveNotesToSupabase = async () => {
            if (!currentUser || !dataLoaded) {
                return;
            }
            saveCurrentPage();
            // Save both pages and current page index in a single object
            const saveData = {
                pages: pages,
                currentPageIndex: currentPageIndex
            };
            const notesJson = JSON.stringify(saveData);
            const { error } = await supabaseClient.from('profiles').update({ profile_text: notesJson }).eq('id', currentUser.id);
            if (error) {
                console.error('Error saving to Supabase:', error);
            }
        };
        
        const debouncedSave = _.debounce(saveNotesToSupabase, 2000);

        // --- NEW, ROBUST AUTH HANDLING ---
        const setupAuthenticatedApp = async (session) => {
            currentUser = session.user;
            await loadNotesFromSupabase();
            userEmailDisplay.textContent = currentUser.email;
            authContainer.classList.add('d-none');
            appContainer.classList.remove('d-none');
            resizeCanvas();
            hideLoader();
        };

        const setupLoginPage = () => {
            currentUser = null;
            authContainer.classList.remove('d-none');
            appContainer.classList.add('d-none');
            pages = [null];
            currentPageIndex = 0;
            dataLoaded = false;
            hideLoader();
        };

        const initializeApp = async () => {
            showLoader();
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) { console.error("Error getting session:", error); setupLoginPage(); return; }
            if (session) { await setupAuthenticatedApp(session); } else { setupLoginPage(); }
        };

        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') { setupAuthenticatedApp(session); } 
            else if (event === 'SIGNED_OUT') { setupLoginPage(); }
        });

        initializeApp();

        // --- Canvas & App Logic ---
        const saveState = () => { 
            if (historyLock) return; 
            redoStack = []; 
            const state = fabricCanvas.toJSON(['isLink', 'url']);
            state.viewportTransform = fabricCanvas.viewportTransform; // Save viewport
            history.push(state); 
            updateHistoryButtons(); 
            debouncedSave(); 
        };
        
        const loadPage = (pageIndex) => {
            if (pageIndex < 0 || pageIndex >= pages.length) return;
            currentPageIndex = pageIndex;
            const pageData = pages[currentPageIndex];
            historyLock = true;
            fabricCanvas.clear();
            fabricCanvas.backgroundColor = '#fff';
            if (pageData) {
                fabricCanvas.loadFromJSON(pageData, () => {
                    if (pageData.viewportTransform) {
                        fabricCanvas.setViewportTransform(pageData.viewportTransform);
                    } else {
                        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    }
                    fabricCanvas.renderAll();
                    resetHistory(pageData);
                    historyLock = false;
                });
            } else {
                fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                fabricCanvas.renderAll();
                resetHistory();
                historyLock = false;
            }
            updatePageIndicator();
        };

        if ('ontouchstart' in window) { fabric.Object.prototype.set({ cornerSize: 15, touchCornerSize: 44, transparentCorners: true, cornerColor: 'rgba(0,123,255,0.7)', borderColor: 'rgba(0,123,255,0.7)', cornerStyle: 'circle' }); }
        const resizeCanvas = () => { if (!appContainer.classList.contains('d-none')) { const { clientWidth, clientHeight } = canvasContainer; fabricCanvas.setWidth(clientWidth).setHeight(clientHeight).renderAll(); } };
        window.addEventListener('resize', resizeCanvas);
        
        // --- FINAL, RELIABLE TOUCH & MOUSE CONTROLS ---
        let isPanning = false;
        let isTouching = false;
        let drawingModeWasActive = false;
        let lastPosX, lastPosY;
        let pinchStartDistance = 0;
        let pinchStartZoom = 1;
        let touchStartTime = 0;
        let lastTouchTarget = null;

        fabricCanvas.on('mouse:wheel', function(opt) {
            if (!opt.e.altKey) return;
            opt.e.preventDefault();
            opt.e.stopPropagation();
            const delta = opt.e.deltaY;
            let zoom = fabricCanvas.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        });

        fabricCanvas.on('mouse:down', function(opt) {
            // Eyedropper logic
            if (currentTool === 'eyedropper') {
                // Get the correct event object for coordinates (mouse vs. touch)
                const pointerEvent = opt.e.touches ? opt.e.touches[0] : opt.e;

                const canvasEl = fabricCanvas.getElement();
                const canvasRect = canvasEl.getBoundingClientRect();
                const x = Math.round(pointerEvent.clientX - canvasRect.left);
                const y = Math.round(pointerEvent.clientY - canvasRect.top);

                // Get context and pixel data from the correct coordinates
                const ctx = canvasEl.getContext('2d');
                const pixel = ctx.getImageData(x, y, 1, 1).data;

                // Function to convert component to hex
                const toHex = (c) => ('0' + c.toString(16)).slice(-2);

                // Construct hex color string
                const hexColor = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;

                // Update UI with the new color
                colorPickers.forEach(p => p.value = hexColor);
                updateBrushSettings(); // Update the brush color immediately

                // Switch back to the drawing tool
                setActiveTool('draw');
                return; // Stop further processing
            }

            if (opt.e.altKey) {
                isPanning = true;
                fabricCanvas.selection = false;
                lastPosX = opt.e.clientX;
                lastPosY = opt.e.clientY;
                fabricCanvas.setCursor('grabbing');
            } else if (!isTouching && currentTool === 'text' && !opt.target) {
                const pointer = fabricCanvas.getPointer(opt.e);
                const text = new fabric.IText('Текст', { left: pointer.x, top: pointer.y, fill: colorPickers[0].value, fontSize: 24, fontFamily: 'Arial', originX: 'center', originY: 'center' });
                fabricCanvas.add(text);
                fabricCanvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
                setActiveTool('select');
            }
        });

        fabricCanvas.on('mouse:move', function(opt) {
            if (isPanning && !isTouching) {
                const vpt = this.viewportTransform;
                vpt[4] += opt.e.clientX - lastPosX;
                vpt[5] += opt.e.clientY - lastPosY;
                this.requestRenderAll();
                lastPosX = opt.e.clientX;
                lastPosY = opt.e.clientY;
            }
        });

        fabricCanvas.on('mouse:up', function(opt) {
            if (isPanning && !isTouching) {
                isPanning = false;
                fabricCanvas.selection = true;
                fabricCanvas.setCursor('default');
                saveState(); // Save state after panning
            } else if (!isTouching && opt.target && opt.target.isLink && !opt.target.isEditing) {
                window.open(opt.target.url, '_blank');
            }
        });

        const canvasEl = fabricCanvas.getElement().parentElement;
        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };
        const getTouchCenter = (touches) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });

        canvasEl.addEventListener('touchstart', (e) => {
            isTouching = true;
            if (e.touches.length === 1) {
                touchStartTime = Date.now();
                lastTouchTarget = fabricCanvas.findTarget(e, false);
            }
            if (e.touches.length === 2) {
                e.preventDefault();
                isPanning = true;
                if (fabricCanvas.isDrawingMode) {
                    drawingModeWasActive = true;
                    fabricCanvas.isDrawingMode = false;
                }
                fabricCanvas.selection = false;
                pinchStartDistance = getTouchDistance(e.touches);
                pinchStartZoom = fabricCanvas.getZoom();
                const center = getTouchCenter(e.touches);
                lastPosX = center.x;
                lastPosY = center.y;
            }
        }, { passive: false });

        canvasEl.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPanning) {
                e.preventDefault();
                const center = getTouchCenter(e.touches);
                const vpt = fabricCanvas.viewportTransform;
                vpt[4] += center.x - lastPosX;
                vpt[5] += center.y - lastPosY;
                const currentDist = getTouchDistance(e.touches);
                const zoomRatio = currentDist / pinchStartDistance;
                const newZoom = pinchStartZoom * zoomRatio;
                fabricCanvas.zoomToPoint(new fabric.Point(vpt[4], vpt[5]), newZoom);
                fabricCanvas.requestRenderAll();
                lastPosX = center.x;
                lastPosY = center.y;
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            if (e.touches.length === 0 && e.changedTouches.length === 1 && !isPanning && touchDuration < 250) {
                 if (lastTouchTarget && lastTouchTarget.isLink) { window.open(lastTouchTarget.url, '_blank'); }
            }
            if (isPanning && e.touches.length < 2) {
                isPanning = false;
                fabricCanvas.selection = true;
                if (drawingModeWasActive) {
                    fabricCanvas.isDrawingMode = true;
                    drawingModeWasActive = false;
                }
                saveState(); // Save state after touch pan/zoom
            }
            if (e.touches.length === 0) { isTouching = false; lastTouchTarget = null; }
        }, { passive: false });

        const updateHistoryButtons = () => {
            const undoDisabled = history.length <= 1;
            const redoDisabled = redoStack.length === 0;
            historyButtons.undo.disabled = undoDisabled;
            historyButtons.mobileUndo.disabled = undoDisabled;
            historyButtons.redo.disabled = redoDisabled;
            historyButtons.mobileRedo.disabled = redoDisabled;
        };

        const resetHistory = (initialState = null) => {
            const state = initialState || fabricCanvas.toJSON(['isLink', 'url']);
            if (!state.viewportTransform) {
                state.viewportTransform = [1, 0, 0, 1, 0, 0];
            }
            history = [state];
            redoStack = [];
            updateHistoryButtons();
        };

        const undo = () => {
            if (history.length > 1) {
                historyLock = true;
                redoStack.push(history.pop());
                const prevState = history[history.length - 1];
                fabricCanvas.loadFromJSON(prevState, () => {
                    if (prevState.viewportTransform) {
                        fabricCanvas.setViewportTransform(prevState.viewportTransform);
                    }
                    fabricCanvas.renderAll();
                    historyLock = false;
                    updateHistoryButtons();
                });
            }
        };

        const redo = () => {
            if (redoStack.length > 0) {
                historyLock = true;
                const nextState = redoStack.pop();
                history.push(nextState);
                fabricCanvas.loadFromJSON(nextState, () => {
                    if (nextState.viewportTransform) {
                        fabricCanvas.setViewportTransform(nextState.viewportTransform);
                    }
                    fabricCanvas.renderAll();
                    historyLock = false;
                    updateHistoryButtons();
                });
            }
        };

        historyButtons.undo.addEventListener('click', undo);
        historyButtons.mobileUndo.addEventListener('click', undo);
        historyButtons.redo.addEventListener('click', redo);
        historyButtons.mobileRedo.addEventListener('click', redo);
        historyButtons.showAll.addEventListener('click', showAll);

        const saveCurrentPage = () => {
            const pageData = fabricCanvas.toJSON(['isLink', 'url']);
            pageData.viewportTransform = fabricCanvas.viewportTransform;
            pages[currentPageIndex] = pageData;
        };
        const updatePageIndicator = () => { pageControls.indicator.textContent = `Стр. ${currentPageIndex + 1} / ${pages.length}`; };
        
        const setActiveTool = (tool) => {
            currentTool = tool;
            // Drawing mode is only for pencil and marker
            fabricCanvas.isDrawingMode = tool === 'draw' || tool === 'marker';

            // Set cursor style
            if (tool === 'eyedropper') {
                fabricCanvas.defaultCursor = 'crosshair';
                fabricCanvas.hoverCursor = 'crosshair';
            } else {
                fabricCanvas.defaultCursor = 'default';
                fabricCanvas.hoverCursor = 'default';
            }
            fabricCanvas.renderAll();


            updateBrushSettings(); // Centralized brush configuration

            toolButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });

            // Toggle mobile draw options
            if (tool === 'draw' || tool === 'marker') {
                mobileDrawOptions.classList.add('active');
                document.body.classList.add('draw-tool-active');
            } else {
                mobileDrawOptions.classList.remove('active');
                document.body.classList.remove('draw-tool-active');
            }
            // Use a timeout to ensure the DOM has updated before resizing
            setTimeout(resizeCanvas, 210); // 210ms is slightly longer than the CSS transition
        };

        function showAll() {
            fabricCanvas.discardActiveObject();
            const objects = fabricCanvas.getObjects();
            if (objects.length === 0) {
                const newVpt = [1, 0, 0, 1, 0, 0];
                fabricCanvas.setViewportTransform(newVpt);
                fabricCanvas.renderAll();
                saveState();
                return;
            }
            const group = new fabric.Group(objects);
            const aabb = group.getBoundingRect();
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            const scale = Math.min(canvasWidth / aabb.width, canvasHeight / aabb.height) * 0.95;
            const newVpt = [...fabricCanvas.viewportTransform];
            newVpt[0] = scale;
            newVpt[3] = scale;
            newVpt[4] = (canvasWidth - (aabb.width * scale)) / 2 - (aabb.left * scale);
            newVpt[5] = (canvasHeight - (aabb.height * scale)) / 2 - (aabb.top * scale);
            fabricCanvas.setViewportTransform(newVpt);
            fabricCanvas.renderAll();
            saveState();
        }

        function exportCanvas() {
            const dataURL = fabricCanvas.toDataURL({
                format: 'png',
                quality: 1.0
            });
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `gMemo-page-${currentPageIndex + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

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
                        const linkText = new fabric.IText(text, { left: 150, top: 150, fontSize: 24, fill: '#007bff', underline: true, fontFamily: 'Arial', isLink: true, url: url });
                        fabricCanvas.add(linkText);
                    } else {
                        setActiveTool(tool);
                    }
                }
            });
        });

        colorPickers.forEach(picker => { picker.addEventListener('input', (e) => { const newColor = e.target.value; colorPickers.forEach(p => p.value = newColor); updateBrushSettings(); }); });
        
        const updateLineWidth = (newWidth) => {
            const clampedWidth = Math.max(1, Math.min(50, newWidth));
            // This function now only updates the UI state.
            // The actual brush width is set in updateBrushSettings.
            lineWidthSliders.forEach(s => s.value = clampedWidth);
            lineWidthValues.desktop.textContent = clampedWidth;
            lineWidthValues.mobile.textContent = clampedWidth;
            updateBrushSettings(); // Update brush settings when width changes
        };

        lineWidthSliders.forEach(slider => { slider.addEventListener('input', (e) => updateLineWidth(parseInt(e.target.value, 10))); });
        widthIncreaseBtn.addEventListener('click', () => updateLineWidth(fabricCanvas.freeDrawingBrush.width + 1));
        widthDecreaseBtn.addEventListener('click', () => updateLineWidth(fabricCanvas.freeDrawingBrush.width - 1));

        imageUploadInputs.forEach(input => { input.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (f) => { fabric.Image.fromURL(f.target.result, (img) => { img.scaleToWidth(200); fabricCanvas.add(img); }); }; reader.readAsDataURL(file); e.target.value = ''; }); });
        window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && !fabricCanvas.getActiveObject()?.isEditing) { document.querySelector('[data-tool="delete"]').click(); } });
        
        fabricCanvas.on({ 'object:added': saveState, 'object:removed': saveState, 'object:modified': saveState });
        fabricCanvas.on('mouse:dblclick', (options) => { if (options.target) { if (options.target.isLink) { const target = options.target; const newText = prompt("Измените текст ссылки:", target.text); if (newText !== null) target.set('text', newText); const newUrl = prompt("Измените URL:", target.url); if (newUrl !== null) target.set('url', newUrl); fabricCanvas.renderAll(); } else if (options.target.type === 'i-text') { const target = options.target; target.enterEditing(); const selectionStart = target.getSelectionStartFromPointer(options.e); const start = target.findWordBoundaryLeft(selectionStart); const end = target.findWordBoundaryRight(selectionStart); target.setSelectionStart(start); target.setSelectionEnd(end); fabricCanvas.renderAll(); } } });

        // --- Page Navigation with IMMEDIATE save ---
        pageControls.prev.addEventListener('click', async () => { if (currentPageIndex > 0) { showLoader(); await saveNotesToSupabase(); loadPage(currentPageIndex - 1); hideLoader(); } });
        pageControls.next.addEventListener('click', async () => { if (currentPageIndex < pages.length - 1) { showLoader(); await saveNotesToSupabase(); loadPage(currentPageIndex + 1); hideLoader(); } });
        pageControls.add.addEventListener('click', async () => { showLoader(); await saveNotesToSupabase(); pages.push(null); loadPage(pages.length - 1); hideLoader(); });
        pageControls.delete.addEventListener('click', async () => { if (pages.length <= 1) { alert("Нельзя удалить последнюю страницу."); return; } if (confirm("Вы уверены, что хотите удалить эту страницу?")) { showLoader(); pages.splice(currentPageIndex, 1); if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1; loadPage(currentPageIndex); await saveNotesToSupabase(); hideLoader(); } });
        pageControls.export.addEventListener('click', exportCanvas);

    } catch (e) {
        console.error("A critical error occurred in the application script:", e);
        alert("Произошла критическая ошибка. Пожалуйста, проверьте консоль разработчика.");
    }
});

// --- Helper to prevent accidental closure ---
window.addEventListener('beforeunload', (e) => {
    if (document.getElementById('app-container').classList.contains('d-none')) {
        return; // Don't show prompt on auth screen
    }
    e.preventDefault();
    e.returnValue = '';
});
