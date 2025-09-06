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
        const historyButtons = { undo: document.getElementById('undo-button'), redo: document.getElementById('redo-button') };
        const pageControls = { prev: document.getElementById('prev-page'), next: document.getElementById('next-page'), add: document.getElementById('add-page'), delete: document.getElementById('delete-page'), indicator: document.getElementById('page-indicator') };

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
                    const savedPages = JSON.parse(data.profile_text);
                    if (Array.isArray(savedPages) && savedPages.length > 0) {
                        pages = savedPages;
                    }
                } catch (e) {
                    console.error('Error parsing saved notes JSON:', e);
                }
            }
            loadPage(0);
            dataLoaded = true;
        };

        const saveNotesToSupabase = async () => {
            if (!currentUser || !dataLoaded) {
                return;
            }
            saveCurrentPage();
            const notesJson = JSON.stringify(pages);
            const { error } = await supabaseClient.from('profiles').update({ profile_text: notesJson }).eq('id', currentUser.id);
            if (error) {
                console.error('Error saving to Supabase:', error);
            }
        };
        
        const debouncedSave = _.debounce(saveNotesToSupabase, 2000);

        // --- NEW, ROBUST AUTH HANDLING ---

        // This function sets up the application based on a valid session.
        const setupAuthenticatedApp = async (session) => {
            currentUser = session.user;
            await loadNotesFromSupabase();
            userEmailDisplay.textContent = currentUser.email;
            authContainer.classList.add('d-none');
            appContainer.classList.remove('d-none');
            resizeCanvas();
            hideLoader();
        };

        // This function resets the UI to the login page.
        const setupLoginPage = () => {
            currentUser = null;
            authContainer.classList.remove('d-none');
            appContainer.classList.add('d-none');
            pages = [null];
            currentPageIndex = 0;
            dataLoaded = false;
            hideLoader();
        };

        // The main function to start the application.
        const initializeApp = async () => {
            showLoader();
            // getSession() is the reliable way to check for a session on page load.
            // It waits for the client to be fully initialized.
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error("Error getting session:", error);
                setupLoginPage();
                return;
            }

            if (session) {
                await setupAuthenticatedApp(session);
            } else {
                setupLoginPage();
            }
        };

        // onAuthStateChange now only handles events that happen *after* the initial page load.
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                setupAuthenticatedApp(session);
            } else if (event === 'SIGNED_OUT') {
                setupLoginPage();
            }
        });

        // Start the application.
        initializeApp();

        // --- Canvas & App Logic ---
        const saveState = () => { if (historyLock) return; redoStack = []; history.push(fabricCanvas.toJSON(['isLink', 'url'])); updateHistoryButtons(); debouncedSave(); };
        const loadPage = (pageIndex) => { if (pageIndex < 0 || pageIndex >= pages.length) return; currentPageIndex = pageIndex; const pageData = pages[currentPageIndex]; historyLock = true; fabricCanvas.clear(); fabricCanvas.backgroundColor = '#fff'; if (pageData) { fabricCanvas.loadFromJSON(pageData, () => { fabricCanvas.renderAll(); resetHistory(pageData); historyLock = false; }); } else { fabricCanvas.renderAll(); resetHistory(); historyLock = false; } updatePageIndicator(); };
        if ('ontouchstart' in window) { fabric.Object.prototype.set({ cornerSize: 15, touchCornerSize: 44, transparentCorners: true, cornerColor: 'rgba(0,123,255,0.7)', borderColor: 'rgba(0,123,255,0.7)', cornerStyle: 'circle' }); }
        const resizeCanvas = () => { if (!appContainer.classList.contains('d-none')) { const { clientWidth, clientHeight } = canvasContainer; fabricCanvas.setWidth(clientWidth).setHeight(clientHeight).renderAll(); } };
        window.addEventListener('resize', resizeCanvas);
        let isPanning = false, panMode = 'none', lastPosX, lastPosY;
        let gestureJustEnded = false; // Флаг для предотвращения клика по ссылке после жеста
        let drawingModeWasActive = false; // Флаг для восстановления режима рисования

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
                // При начале жеста отключаем режим рисования, если он был активен
                if (!isPanning && fabricCanvas.isDrawingMode) {
                    drawingModeWasActive = true;
                    fabricCanvas.isDrawingMode = false;
                }
                isPanning = true; // Жест активен
                panMode = 'touch';

                // Масштабирование
                let zoom = fabricCanvas.getZoom();
                zoom *= opt.self.scale;
                if (zoom > 20) zoom = 20;
                if (zoom < 0.01) zoom = 0.01;
                fabricCanvas.zoomToPoint({ x: opt.self.x, y: opt.self.y }, zoom);

                // Панорамирование
                const vpt = this.viewportTransform;
                vpt[4] += opt.self.new_x - opt.self.x;
                vpt[5] += opt.self.new_y - opt.self.y;
                this.requestRenderAll();
            }
        });

        fabricCanvas.on('mouse:move', function(opt) {
            const e = opt.e;
            // Логика панорамирования для мыши (Alt + Drag)
            if (isPanning && panMode === 'mouse') {
                const vpt = this.viewportTransform;
                const currentX = e.clientX;
                const currentY = e.clientY;
                vpt[4] += currentX - lastPosX;
                vpt[5] += currentY - lastPosY;
                this.requestRenderAll();
                lastPosX = currentX;
                lastPosY = currentY;
            }
        });
        const updateHistoryButtons = () => { historyButtons.undo.disabled = history.length <= 1; historyButtons.redo.disabled = redoStack.length === 0; };
        const resetHistory = (initialState = null) => { const state = initialState || fabricCanvas.toJSON(['isLink', 'url']); history = [state]; redoStack = []; updateHistoryButtons(); };
        historyButtons.undo.addEventListener('click', () => { if (history.length > 1) { historyLock = true; redoStack.push(history.pop()); const prevState = history[history.length - 1]; fabricCanvas.loadFromJSON(prevState, () => { fabricCanvas.renderAll(); historyLock = false; updateHistoryButtons(); }); } });
        historyButtons.redo.addEventListener('click', () => { if (redoStack.length > 0) { historyLock = true; const nextState = redoStack.pop(); history.push(nextState); fabricCanvas.loadFromJSON(nextState, () => { fabricCanvas.renderAll(); historyLock = false; updateHistoryButtons(); }); } });
        const saveCurrentPage = () => pages[currentPageIndex] = fabricCanvas.toJSON(['isLink', 'url']);
        const updatePageIndicator = () => { pageControls.indicator.textContent = `Стр. ${currentPageIndex + 1} / ${pages.length}`; };
        const setActiveTool = (tool) => { currentTool = tool; fabricCanvas.isDrawingMode = tool === 'draw'; toolButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.tool === tool); }); };
        toolButtons.forEach(btn => { btn.addEventListener('click', (e) => { const tool = e.currentTarget.dataset.tool; if (tool) { if (tool === 'delete') { fabricCanvas.getActiveObjects().forEach(obj => fabricCanvas.remove(obj)); fabricCanvas.discardActiveObject().renderAll(); } else if (tool === 'link') { const url = prompt("Введите URL ссылки:", "https://"); if (!url) return; const text = prompt("Введите текст для ссылки:", "Моя ссылка"); if (!text) return; const linkText = new fabric.IText(text, { left: 150, top: 150, fontSize: 24, fill: '#007bff', underline: true, fontFamily: 'Arial', isLink: true, url: url }); fabricCanvas.add(linkText); } else { setActiveTool(tool); } } }); });
        colorPickers.forEach(picker => { picker.addEventListener('input', (e) => { const newColor = e.target.value; fabricCanvas.freeDrawingBrush.color = newColor; colorPickers.forEach(p => p.value = newColor); }); });
        lineWidthSliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const newWidth = parseInt(e.target.value, 10);
                fabricCanvas.freeDrawingBrush.width = newWidth;
                // Update both sliders and value displays simultaneously
                lineWidthSliders.forEach(s => s.value = newWidth);
                lineWidthValues.desktop.textContent = newWidth;
                lineWidthValues.mobile.textContent = newWidth;
            });
        });
        imageUploadInputs.forEach(input => { input.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (f) => { fabric.Image.fromURL(f.target.result, (img) => { img.scaleToWidth(200); fabricCanvas.add(img); }); }; reader.readAsDataURL(file); e.target.value = ''; }); });
        window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && !fabricCanvas.getActiveObject()?.isEditing) { document.querySelector('[data-tool="delete"]').click(); } });
        fabricCanvas.on('mouse:down', function(opt) {
            if (opt.e.altKey) {
                isPanning = true;
                panMode = 'mouse';
                fabricCanvas.selection = false;
                lastPosX = opt.e.clientX;
                lastPosY = opt.e.clientY;
                fabricCanvas.setCursor('grabbing');
                return; // Выходим, чтобы не создавать текст и т.д.
            }
            if (currentTool === 'text' && !opt.target && !isPanning) {
                const pointer = fabricCanvas.getPointer(opt.e);
                const text = new fabric.IText('Текст', { left: pointer.x, top: pointer.y, fill: colorPickers[0].value, fontSize: 24, fontFamily: 'Arial', originX: 'center', originY: 'center' });
                fabricCanvas.add(text);
                fabricCanvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
                setActiveTool('select');
            }
        });
        fabricCanvas.on('mouse:up', function(opt) {
            if (isPanning) {
                if (panMode === 'touch') {
                    gestureJustEnded = true;
                    setTimeout(() => { gestureJustEnded = false; }, 200); // Сбрасываем флаг через короткое время
                }
                isPanning = false;
                panMode = 'none';
                fabricCanvas.selection = true;
                fabricCanvas.setCursor('default');
                // Восстанавливаем режим рисования, если он был активен до жеста
                if (drawingModeWasActive) {
                    fabricCanvas.isDrawingMode = true;
                    drawingModeWasActive = false;
                }
            } else if (opt.target && opt.target.isLink && !opt.target.isEditing && !gestureJustEnded) {
                window.open(opt.target.url, '_blank');
            }
        });
        fabricCanvas.on({ 'object:added': saveState, 'object:removed': saveState, 'object:modified': saveState });
        fabricCanvas.on('mouse:dblclick', (options) => { if (options.target) { if (options.target.isLink) { const target = options.target; const newText = prompt("Измените текст ссылки:", target.text); if (newText !== null) target.set('text', newText); const newUrl = prompt("Измените URL:", target.url); if (newUrl !== null) target.set('url', newUrl); fabricCanvas.renderAll(); } else if (options.target.type === 'i-text') { const target = options.target; target.enterEditing(); const selectionStart = target.getSelectionStartFromPointer(options.e); const start = target.findWordBoundaryLeft(selectionStart); const end = target.findWordBoundaryRight(selectionStart); target.setSelectionStart(start); target.setSelectionEnd(end); fabricCanvas.renderAll(); } } });

        // --- Page Navigation with IMMEDIATE save ---
        pageControls.prev.addEventListener('click', async () => { if (currentPageIndex > 0) { showLoader(); await saveNotesToSupabase(); loadPage(currentPageIndex - 1); hideLoader(); } });
        pageControls.next.addEventListener('click', async () => { if (currentPageIndex < pages.length - 1) { showLoader(); await saveNotesToSupabase(); loadPage(currentPageIndex + 1); hideLoader(); } });
        pageControls.add.addEventListener('click', async () => { showLoader(); await saveNotesToSupabase(); pages.push(null); loadPage(pages.length - 1); hideLoader(); });
        pageControls.delete.addEventListener('click', async () => { if (pages.length <= 1) { alert("Нельзя удалить последнюю страницу."); return; } if (confirm("Вы уверены, что хотите удалить эту страницу?")) { showLoader(); pages.splice(currentPageIndex, 1); if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1; loadPage(currentPageIndex); await saveNotesToSupabase(); hideLoader(); } });

    } catch (e) {
        console.error("A critical error occurred in the application script:", e);
        alert("Произошла критическая ошибка. Пожалуйста, проверьте консоль разработчика.");
    }
});