if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use the correct path for different deployment scenarios
    let swPath;
    if (window.location.protocol === 'file:') {
      // For local file access (opening index.html directly in browser)
      swPath = './sw.js';
    } else {
      // For GitHub Pages (and other web servers)
      swPath = './sw.js';
    }
    
    navigator.serviceWorker.register(swPath).then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Bootstrap dropdowns
    const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });
    
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
        const showLoginButton = document.getElementById('show-login-button');
        const offlineButton = document.getElementById('offline-button');
        const exportJsonButton = document.getElementById('export-json-button');
        const jsonUploadInput = document.getElementById('json-upload-input');
        const saveIndicator = document.getElementById('save-indicator');
        const canvasContainer = document.getElementById('canvas-container');
        const canvasElement = document.getElementById('canvas');
        const navigatorToolButton = document.getElementById('navigator-tool-button');
        const mobileNavigatorToolButton = document.getElementById('mobile-navigator-tool-button');
        const navigatorPanel = document.getElementById('navigator-panel');
        const zoomIndicator = document.getElementById('zoom-indicator'); // --- NEW: Zoom indicator element ---

        // --- Navigator Panel Drag Logic ---
        let isDragging = false;
        let offsetX, offsetY;

        const dragStart = (e) => {
            isDragging = true;
            // Учитываем возможное смещение из-за transform
            const rect = navigatorPanel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            // Предотвращаем выделение текста при перетаскивании
            e.preventDefault();
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // Ограничиваем движение в пределах окна
            const panelRect = navigatorPanel.getBoundingClientRect();
            const bodyRect = document.body.getBoundingClientRect();

            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + panelRect.width > bodyRect.width) newX = bodyRect.width - panelRect.width;
            if (newY + panelRect.height > bodyRect.height) newY = bodyRect.height - panelRect.height;

            navigatorPanel.style.left = `${newX}px`;
            navigatorPanel.style.top = `${newY}px`;
            // Сбрасываем right и bottom, так как теперь позиционируем по left и top
            navigatorPanel.style.right = 'auto';
            navigatorPanel.style.bottom = 'auto';
        };

        const dragEnd = () => {
            isDragging = false;
        };

        navigatorPanel.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        // Для мобильных устройств
        navigatorPanel.addEventListener('touchstart', (e) => dragStart(e.touches[0]), { passive: false });
        document.addEventListener('touchmove', (e) => dragMove(e.touches[0]));
        document.addEventListener('touchend', dragEnd);
        // --- End Navigator Panel Drag Logic ---

        const navButtons = {
            up: document.getElementById('nav-up'),
            down: document.getElementById('nav-down'),
            left: document.getElementById('nav-left'),
            right: document.getElementById('nav-right')
        };
        const toolButtons = document.querySelectorAll('[data-tool]');
        const colorPickers = document.querySelectorAll('.color-picker-input');
        const lineWidthSliders = document.querySelectorAll('.line-width-slider');
        const lineWidthValues = {
            desktop: document.getElementById('line-width-value-desktop'),
            mobile: document.getElementById('line-width-value-mobile')
        };
        const imageUploadInputs = document.querySelectorAll('.image-upload-input');
        const svgUploadInputs = document.querySelectorAll('.svg-upload-input');
        const historyButtons = { 
            undo: document.getElementById('undo-button'), 
            redo: document.getElementById('redo-button'),
            mobileUndo: document.getElementById('mobile-undo-button'),
            mobileRedo: document.getElementById('mobile-redo-button'),
            showAll: document.getElementById('show-all-button'),
            grid: document.getElementById('grid-button')
        };
        const pageControls = { 
            prev: document.getElementById('prev-page'), 
            next: document.getElementById('next-page'), 
            add: document.getElementById('add-page'), 
            delete: document.getElementById('delete-page'), 
            indicator: document.getElementById('page-indicator'),
            exportPng: document.getElementById('export-png-button'),
            exportSvg: document.getElementById('export-svg-button')
        };
        
        // --- Mobile Draw Options Elements ---
        const mobileDrawOptions = document.getElementById('mobile-draw-options');
        const widthIncreaseBtn = document.getElementById('width-increase-mobile');
        const widthDecreaseBtn = document.getElementById('width-decrease-mobile');
        const mobileShapesToggle = document.getElementById('mobile-shapes-toggle');
        const mobileShapesOptions = document.getElementById('mobile-shapes-options');
        const mobileActionsToggle = document.getElementById('mobile-actions-toggle');
        const mobileActionsOptions = document.getElementById('mobile-actions-options');

        // --- Voice Input Elements ---
        const voiceModalElement = document.getElementById('voice-modal');
        const voiceModal = new bootstrap.Modal(voiceModalElement);
        const voiceTextResult = document.getElementById('voice-text-result');
        const voiceSaveButton = document.getElementById('voice-save-button');
        const voiceRecordButton = document.getElementById('voice-record-button');

        // --- Mobile Text Controls ---
        const textControls = document.getElementById('text-controls');
        const copyTextBtn = document.getElementById('copy-text-btn');
        const pasteTextBtn = document.getElementById('paste-text-btn');


        // --- App State ---
        let pages = [null];
        let currentPageIndex = 0;
        let currentTool = null;
        let isNavigatorMode = false;
        let history = [];
        let redoStack = [];
        let historyLock = false;
        let currentUser = null;
        let dataLoaded = false;
        let isDrawingShape = false;
        let shapeInProgress = null;
        let startX, startY;
        let isCreatingText = false;
        let textCreationInfo = null;
        let voiceInputPosition = null; // Для хранения координат клика для голосового ввода
        let isGridVisible = false;
        const gridSpacing = 50; // Расстояние между линиями сетки в пикселях
        const gridColor = '#e0e0e0';
        let isZoomedToFit = false; // --- NEW: State for showAll toggle ---
        let realtimeChannel = null; // Для хранения подписки Realtime
        let clientId = crypto.randomUUID(); // --- MODIFIED: Unique ID for this tab/session ---
        let isApplyingRemoteChange = false; // --- NEW: Flag to prevent broadcasting remote changes ---
        let isLeader = false;
        let heartbeatInterval = null;
        const HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
        let zoomIndicatorTimeout = null; // --- NEW: Timeout for zoom indicator ---

        // --- Voice Recognition Setup ---
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition;
        let isRecording = false;
        let textBeforeCurrentSession = "";

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'ru-RU';

            recognition.onresult = (event) => {
                let interim_transcript = '';
                let final_transcript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final_transcript += event.results[i][0].transcript;
                    } else {
                        interim_transcript += event.results[i][0].transcript;
                    }
                }
                
                const separator = textBeforeCurrentSession.trim().length > 0 ? '\n' : '';
                voiceTextResult.value = textBeforeCurrentSession + separator + final_transcript + interim_transcript;
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                if (event.error === 'not-allowed') {
                    alert("Доступ к микрофону заблокирован. Пожалуйста, разрешите доступ в настройках вашего браузера.");
                } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
                    alert(`Ошибка распознавания: ${event.error}`);
                }
                isRecording = false; 
                voiceRecordButton.classList.remove('recording');
            };
            
            recognition.onend = () => {
                isRecording = false;
                voiceRecordButton.classList.remove('recording');
            };

        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }

        // --- Voice Modal Logic ---
        if (SpeechRecognition) {
            const startRecording = (e) => {
                e.preventDefault();
                if (!recognition || isRecording) return;
                
                textBeforeCurrentSession = voiceTextResult.value;
                try {
                    recognition.start();
                    isRecording = true;
                    voiceRecordButton.classList.add('recording');
                } catch (err) {
                    console.error("Error starting recognition:", err);
                }
            };

            const stopRecording = (e) => {
                e.preventDefault();
                if (!recognition || !isRecording) return;
                
                recognition.stop();
                // isRecording и класс будут сброшены в onend
            };

            // Mouse events
            voiceRecordButton.addEventListener('mousedown', startRecording);
            voiceRecordButton.addEventListener('mouseup', stopRecording);
            voiceRecordButton.addEventListener('mouseleave', stopRecording); // Stop if mouse leaves button while pressed

            // Touch events
            voiceRecordButton.addEventListener('touchstart', startRecording, { passive: false });
            voiceRecordButton.addEventListener('touchend', stopRecording);


            voiceModalElement.addEventListener('hidden.bs.modal', () => {
                if (isRecording) {
                    recognition.stop();
                }
                setActiveTool('select');
            });

            voiceSaveButton.addEventListener('click', () => {
                const text = voiceTextResult.value.trim();
                if (text && voiceInputPosition) {
                    let textObject;
                    const newUuid = crypto.randomUUID();
                    if (voiceInputPosition.isTextbox) {
                        // Create a Textbox
                        textObject = new fabric.Textbox(text, {
                            left: voiceInputPosition.x,
                            top: voiceInputPosition.y,
                            width: voiceInputPosition.width,
                            height: voiceInputPosition.height,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            uuid: newUuid
                        });
                    } else {
                        // Create an IText
                        textObject = new fabric.IText(text, {
                            left: voiceInputPosition.x,
                            top: voiceInputPosition.y,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            originX: 'center',
                            originY: 'center',
                            uuid: newUuid
                        });
                    }
                    fabricCanvas.add(textObject);
                    fabricCanvas.setActiveObject(textObject);
                    fabricCanvas.renderAll();
                    
                    broadcastOperation({ type: 'object:added', data: textObject.toJSON(['uuid']) });
                    saveState();
                }
                voiceModal.hide();
                voiceInputPosition = null;
            });
        }


        const updateMobileCanvasPadding = () => {
            if (window.innerWidth >= 992) {
                canvasContainer.style.paddingBottom = '0px';
                return;
            }

            let bottomPadding = 60; // Height of the main mobile toolbar
            if (mobileDrawOptions.classList.contains('active')) {
                bottomPadding += mobileDrawOptions.offsetHeight;
            }
            if (mobileShapesOptions.classList.contains('active')) {
                bottomPadding += mobileShapesOptions.offsetHeight;
            }
            if (mobileActionsOptions.classList.contains('active')) {
                bottomPadding += mobileActionsOptions.offsetHeight;
            }
            canvasContainer.style.paddingBottom = `${bottomPadding}px`;
            resizeCanvas();
        };

        const toggleMobilePanel = (panelElement, bodyClass) => {
            const willBeActive = !panelElement.classList.contains('active');

            // Deactivate all other panels
            [mobileDrawOptions, mobileShapesOptions, mobileActionsOptions].forEach(p => {
                if (p !== panelElement) p.classList.remove('active');
            });
            document.body.className = document.body.className.replace(/\s*\S*-options-active/g, '');


            // Toggle the target panel
            panelElement.classList.toggle('active', willBeActive);
            if (willBeActive && bodyClass) {
                document.body.classList.add(bodyClass);
            }

            updateMobileCanvasPadding();
            setTimeout(updateMobileCanvasPadding, 210); // Re-check after transition
        };


        // --- Mobile Toolbar Logic ---
        mobileShapesToggle.addEventListener('click', () => {
            toggleMobilePanel(mobileShapesOptions, 'shapes-options-active');
            // If we are closing the panel and a shape tool is active, deactivate the tool
            if (!mobileShapesOptions.classList.contains('active') && ['line', 'arrow', 'rect', 'circle'].includes(currentTool)) {
                setActiveTool(null);
            }
        });

        mobileActionsToggle.addEventListener('click', () => {
            toggleMobilePanel(mobileActionsOptions, 'actions-options-active');
            mobileActionsToggle.classList.toggle('active', mobileActionsOptions.classList.contains('active'));
        });
        
        // --- UI State Functions ---
        const showLoader = () => loadingOverlay.classList.remove('d-none');
        const hideLoader = () => loadingOverlay.classList.add('d-none');
        
        // --- NEW: Zoom Indicator Logic ---
        const updateZoomIndicator = () => {
            if (!zoomIndicator) return;
            
            clearTimeout(zoomIndicatorTimeout);
            
            const zoom = fabricCanvas.getZoom();
            const percentage = Math.round(zoom * 100);
            zoomIndicator.textContent = `${percentage}%`;
            zoomIndicator.classList.add('visible');

            zoomIndicatorTimeout = setTimeout(() => {
                zoomIndicator.classList.remove('visible');
            }, 2000);
        };

        // --- Fabric.js Canvas Initialization ---
        const fabricCanvas = new fabric.Canvas(canvasElement, { isDrawingMode: false, backgroundColor: '#fff', selection: false });
        
        // --- FIX: Set the correct textBaseline to prevent console warnings ---
        fabric.Object.prototype.textBaseline = 'alphabetic';

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
        logoutButton.addEventListener('click', async () => {
            showLoader();
            try {
                // Save final changes before logging out.
                if (currentUser) {
                    await saveNotesToSupabase();
                }

                // Clean up the realtime channel before signing out.
                if (realtimeChannel) {
                    stopHeartbeat();
                    supabaseClient.removeChannel(realtimeChannel);
                    realtimeChannel = null;
                }

                // Attempt to sign out and capture any potential error.
                const { error } = await supabaseClient.auth.signOut();

                // If sign out is successful, the onAuthStateChange listener will handle the UI transition.
                // If there's an error (like "session missing"), the user is effectively already signed out.
                // We must force the UI to the login page state to recover.
                if (error) {
                    console.warn('Error during sign out, but proceeding to login page:', error.message);
                    alert(`Произошла ошибка при выходе, но сессия была завершена: ${error.message}`);
                    setupLoginPage(); // Force UI reset
                }
                // If no error, the 'SIGNED_OUT' event from onAuthStateChange will call setupLoginPage().
            } catch (err) {
                console.error('Exception during logout process:', err);
                alert('Произошла непредвиденная ошибка при выходе.');
                setupLoginPage(); // Also force UI reset on any unexpected exception.
            }
        });

        // --- Local Storage Data Functions ---
        const saveNotesLocally = () => {
            saveCurrentPage();
            const key = currentUser ? `gmemo-user-data-${currentUser.id}` : 'gmemo-local-data';
            const dataToSave = {
                pages: pages,
                currentPageIndex: currentPageIndex,
            };
            const wrappedData = {
                lastModified: new Date().toISOString(),
                data: dataToSave
            };
            localStorage.setItem(key, JSON.stringify(wrappedData));
            
            // For guest users, show the "saved" indicator immediately.
            // For logged-in users, this will be handled by the Supabase save function.
            if (!currentUser) {
                saveIndicator.classList.remove('unsaved');
                saveIndicator.classList.add('saved');
                setTimeout(() => {
                    saveIndicator.classList.remove('saved');
                }, 1500);
            }
        };

        const loadNotesLocally = (key = 'gmemo-local-data') => {
            const localDataString = localStorage.getItem(key);
            if (localDataString) {
                try {
                    const parsedData = JSON.parse(localDataString);
                    // Check for new format vs old format
                    const savedData = parsedData.data ? parsedData.data : parsedData;

                    if (savedData && typeof savedData === 'object') {
                        pages = Array.isArray(savedData.pages) ? savedData.pages : [null];
                        const savedCurrentPageIndex = savedData.currentPageIndex || 0;
                        
                        if (savedCurrentPageIndex >= pages.length) {
                            loadPage(Math.max(0, pages.length - 1));
                        } else {
                            loadPage(savedCurrentPageIndex);
                        }
                        return parsedData; // Return the full wrapped data for comparison
                    }
                } catch (e) {
                    console.error('Error parsing local notes JSON:', e);
                    loadPage(0); // Load a fresh page if local data is corrupt
                }
            } else {
                loadPage(0); // Load a fresh page if no local data
            }
            return null; // Return null if no data found
        };

        const debouncedSaveLocal = _.debounce(saveNotesLocally, 2000);

        // --- Supabase Data Functions ---
        const calculateChecksum = () => {
            const objects = fabricCanvas.getObjects();
            if (objects.length === 0) {
                return 'empty';
            }
            // Sort by UUID to ensure consistent order
            const sortedObjects = objects.sort((a, b) => (a.uuid || '').localeCompare(b.uuid || ''));
            // Create a simple string representation of key properties
            const repr = sortedObjects.map(o => {
                return `${o.uuid}:${Math.round(o.left)}:${Math.round(o.top)}:${(o.scaleX || 1).toFixed(2)}:${(o.scaleY || 1).toFixed(2)}:${Math.round(o.angle || 0)}`;
            }).join(';');
            return repr;
        };

        const stopHeartbeat = () => {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
                console.log('Stopped sending heartbeats.');
            }
        };

        const startHeartbeat = () => {
            stopHeartbeat(); // Ensure no multiple intervals are running
            console.log('Became leader, starting heartbeats...');
            heartbeatInterval = setInterval(() => {
                const checksum = calculateChecksum();
                broadcastOperation({ type: 'heartbeat', data: { checksum } });
            }, HEARTBEAT_INTERVAL_MS);
        };

        const broadcastOperation = (payload) => {
            if (!realtimeChannel || (isApplyingRemoteChange && !payload.type.startsWith('response:'))) {
                return;
            }
            realtimeChannel.send({
                type: 'broadcast',
                event: 'canvas-operation',
                payload: { ...payload, clientId: clientId, pageIndex: currentPageIndex },
            });
        };

        const handleIncomingOperation = (payload) => {
            // Ignore broadcasts from self
            if (payload.clientId === clientId) return;

            // If the operation is for a different page, ignore it for object manipulations
            if (payload.pageIndex !== currentPageIndex && !payload.type.startsWith('page:') && !payload.type.startsWith('response:')) {
                return;
            }

            isApplyingRemoteChange = true;
            try {
                switch (payload.type) {
                    // Object Operations
                    case 'object:added':
                        fabric.util.enlivenObjects([payload.data], (objects) => {
                            const newObject = objects[0];
                            if (newObject && !fabricCanvas.getObjects().some(o => o.uuid === newObject.uuid)) {
                                fabricCanvas.add(newObject);
                                fabricCanvas.renderAll();
                            }
                        }, 'fabric');
                        break;
                    case 'object:modified':
                        const targetObject = fabricCanvas.getObjects().find(o => o.uuid === payload.data.uuid);
                        if (targetObject) {
                            targetObject.set(payload.data.updates);
                            targetObject.setCoords();
                            fabricCanvas.renderAll();
                        }
                        break;
                    case 'object:removed':
                        const objectsToRemove = fabricCanvas.getObjects().filter(o => payload.data.uuids.includes(o.uuid));
                        if (objectsToRemove.length > 0) {
                            objectsToRemove.forEach(obj => fabricCanvas.remove(obj));
                            fabricCanvas.discardActiveObject().renderAll();
                        }
                        break;
                    case 'objects:cleared':
                        fabricCanvas.clear();
                        fabricCanvas.backgroundColor = '#fff';
                        fabricCanvas.renderAll();
                        break;

                    // Page Operations
                    case 'page:navigate':
                        saveCurrentPage(); // Save local changes before switching
                        loadPage(payload.data.newPageIndex);
                        break;
                    case 'page:add':
                        saveCurrentPage();
                        pages.push(null);
                        updatePageIndicator();
                        break;
                    case 'page:delete':
                        // Save any pending changes on the current page before it's potentially removed
                        saveCurrentPage(); 
                        
                        const { deletedPageIndex, newPageIndex } = payload.data;

                        // Remove the page from the local array
                        if (deletedPageIndex >= 0 && deletedPageIndex < pages.length) {
                            pages.splice(deletedPageIndex, 1);
                        }

                        // Check if the current page was the one deleted
                        if (currentPageIndex === deletedPageIndex) {
                            loadPage(newPageIndex); // Load the new page designated by the sender
                        } else {
                            // If a page before the current one was deleted, we need to decrement the index
                            if (currentPageIndex > deletedPageIndex) {
                                currentPageIndex--;
                            }
                            // Update the UI without reloading the canvas content
                            updatePageIndicator(); 
                        }
                        break;
                    
                    // State Reconciliation
                    case 'heartbeat':
                        if (!isLeader) {
                            const localChecksum = calculateChecksum();
                            if (localChecksum !== payload.data.checksum) {
                                console.warn(`Checksum mismatch! Local: ${localChecksum.substring(0,50)}... Remote: ${payload.data.checksum.substring(0,50)}... Requesting full state.`);
                                broadcastOperation({ type: 'request:full-state', data: { requesterId: clientId } });
                            }
                        }
                        break;
                    case 'request:full-state':
                        if (isLeader) {
                            console.log(`Received full state request from ${payload.data.requesterId}. Responding.`);
                            const fullState = fabricCanvas.toJSON(['uuid']);
                            broadcastOperation({
                                type: 'response:full-state',
                                data: {
                                    requesterId: payload.data.requesterId,
                                    fullState: fullState
                                }
                            });
                        }
                        break;
                    case 'response:full-state':
                        if (payload.data.requesterId === clientId) {
                            console.log('Received full state from leader. Applying...');
                            saveCurrentPage(); // Save current state to history before overwriting
                            fabricCanvas.loadFromJSON(payload.data.fullState, () => {
                                fabricCanvas.renderAll();
                                resetHistory(payload.data.fullState);
                                console.log('Successfully applied full state.');
                            });
                        }
                        break;
                }
            } catch (e) {
                console.error("Error applying remote change:", e);
            } finally {
                isApplyingRemoteChange = false;
            }
        };

        const setupRealtimeSubscription = () => {
            if (realtimeChannel) {
                stopHeartbeat();
                supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            if (!currentUser) return;

            const channelId = `notes-${currentUser.id}`;
            realtimeChannel = supabaseClient.channel(channelId, {
                config: {
                    broadcast: { self: false },
                    presence: { key: clientId },
                },
            });

            const electLeader = () => {
                try {
                    const presenceState = realtimeChannel.presenceState();
                    const clients = Object.values(presenceState).flat();
                    if (clients.length === 0) return;

                    // Find the client that joined first by sorting by their 'joined_at' meta field
                    const sortedClients = clients.sort((a, b) => a.joined_at - b.joined_at);
                    const newLeaderId = sortedClients[0].key;
                    
                    const wasLeader = isLeader;
                    isLeader = (newLeaderId === clientId);

                    console.log(`Presence updated. Clients: ${clients.length}. New leader: ${newLeaderId}. Am I leader? ${isLeader}`);

                    if (isLeader && !wasLeader) {
                        startHeartbeat();
                    } else if (!isLeader && wasLeader) {
                        stopHeartbeat();
                    }
                } catch (e) {
                    console.error("Error electing leader:", e);
                }
            };

            realtimeChannel
                .on('broadcast', { event: 'canvas-operation' }, ({ payload }) => {
                    handleIncomingOperation(payload);
                })
                .on('presence', { event: 'sync' }, electLeader)
                .on('presence', { event: 'join' }, electLeader)
                .on('presence', { event: 'leave' }, electLeader)
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`Successfully subscribed to Realtime channel: ${channelId}`);
                        realtimeChannel.track({ key: clientId, joined_at: Date.now() });
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Realtime subscription error:', err);
                    }
                });
        };

        const getNotesFromSupabase = async () => {
            const { data, error } = await supabaseClient.from('profiles').select('profile_text').single();
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching notes:', error);
                return null;
            }
            if (data && data.profile_text) {
                try {
                    const parsedData = JSON.parse(data.profile_text);
                    // Handle backward compatibility
                    if (!parsedData.data) {
                        return {
                            lastModified: new Date(0).toISOString(), // Old data is considered ancient
                            data: parsedData
                        };
                    }
                    return parsedData;
                } catch (e) {
                    console.error('Error parsing Supabase notes JSON:', e);
                    return null;
                }
            }
            return null;
        };

        const saveNotesToSupabase = async () => {
            if (!currentUser || !dataLoaded) {
                return;
            }
            // The local data is already saved by saveState -> saveNotesLocally,
            // so we just need to read it and send it.
            const key = `gmemo-user-data-${currentUser.id}`;
            const localDataString = localStorage.getItem(key);

            if (!localDataString) {
                console.error("Trying to save to Supabase, but no local data found.");
                return;
            }

            // We send the entire wrapped object to Supabase
            const { error } = await supabaseClient.from('profiles').update({ profile_text: localDataString }).eq('id', currentUser.id);
            
            if (error) {
                console.error('Error saving to Supabase:', error);
                // The indicator remains "unsaved" (red)
            } else {
                // Sync successful, show green indicator
                saveIndicator.classList.remove('unsaved');
                saveIndicator.classList.add('saved');
                setTimeout(() => {
                    saveIndicator.classList.remove('saved');
                }, 1500);
            }
        };
        
        const debouncedSave = _.debounce(saveNotesToSupabase, 2000);

        const syncWithSupabase = async () => {
            if (!currentUser) return;
            const localKey = `gmemo-user-data-${currentUser.id}`;

            // --- THE SAFE SYNC ALGORITHM ---

            // 1. Get both data sources.
            const remoteDataPromise = getNotesFromSupabase();
            const localDataString = localStorage.getItem(localKey);
            const localData = localDataString ? JSON.parse(localDataString) : null;
            
            let remoteData;
            try {
                remoteData = await remoteDataPromise;
            } catch (e) {
                // --- NETWORK ERROR SCENARIO ---
                console.error("Failed to fetch remote data. Aborting sync to prevent data loss.", e);
                // Do nothing further. The app will continue with local data.
                return;
            }

            // 2. Analyze the situation and act accordingly.
            const localExists = localData && localData.data && localData.data.pages.length > 0 && localData.data.pages[0] !== null;
            const remoteExists = remoteData && remoteData.data && remoteData.data.pages.length > 0 && remoteData.data.pages[0] !== null;

            if (localExists && remoteExists) {
                // --- CONFLICT SCENARIO ---
                const localDate = new Date(localData.lastModified);
                const remoteDate = new Date(remoteData.lastModified);

                if (localDate.toISOString() !== remoteDate.toISOString()) {
                    console.log("Conflict detected: Local and remote data have different timestamps.");

                    // Format dates for display
                    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                    localTimestampEl.textContent = `Последнее изменение: ${localDate.toLocaleString(undefined, options)}`;
                    cloudTimestampEl.textContent = `Последнее изменение: ${remoteDate.toLocaleString(undefined, options)}`;

                    // Show "Newest" badge
                    localBadgeEl.classList.add('d-none');
                    cloudBadgeEl.classList.add('d-none');
                    if (localDate > remoteDate) {
                        localBadgeEl.classList.remove('d-none');
                    } else {
                        cloudBadgeEl.classList.remove('d-none');
                    }
                    
                    const userChoice = new Promise(resolve => {
                        resolveLocalButton.onclick = () => {
                            console.log("User chose to keep local data (will overwrite cloud).");
                            resolve('local');
                        };
                        resolveCloudButton.onclick = () => {
                            console.log("User chose to load from cloud (will overwrite local).");
                            resolve('cloud');
                        };
                    });

                    hideLoader();
                    conflictModal.show();
                    const choice = await userChoice;
                    conflictModal.hide();
                    showLoader();

                    if (choice === 'local') {
                        await saveNotesToSupabase(); // Push local changes to the cloud.
                    } else if (choice === 'cloud') {
                        applyLoadedData(remoteData); // Apply cloud data to the canvas.
                        localStorage.setItem(localKey, JSON.stringify(remoteData)); // Save it locally.
                    }
                    hideLoader(); // Hide the spinner after the operation is complete
                } else {
                    // Data is in sync, nothing to do.
                    console.log("Data is already in sync.");
                }

            } else if (localExists && !remoteExists) {
                // --- SIMPLE PUSH SCENARIO ---
                console.log("Local data found, but no remote data. Pushing to cloud...");
                await saveNotesToSupabase();

            } else if (!localExists && remoteExists) {
                // --- SIMPLE PULL SCENARIO ---
                console.log("No local data found, but remote data exists. Pulling from cloud...");
                applyLoadedData(remoteData);
                localStorage.setItem(localKey, JSON.stringify(remoteData));

            } else {
                // --- NEW USER SCENARIO ---
                console.log("No local or remote data found. Loading welcome screen...");
                try {
                    const response = await fetch('firstscreen.json');
                    if (!response.ok) throw new Error('Welcome screen file not found.');
                    let firstScreenData = await response.json();

                    if (firstScreenData.data && firstScreenData.data.pages && firstScreenData.data.pages[0]) {
                        firstScreenData = firstScreenData.data.pages[0];
                    }

                    pages = [firstScreenData];
                    currentPageIndex = 0;
                    loadPage(0);
                    saveNotesLocally(); // This creates the local save file
                    await saveNotesToSupabase(); // This pushes it to the new profile
                } catch (e) {
                    console.warn(e.message, "Could not load welcome screen. Starting blank.");
                    applyLoadedData(null);
                }
            }
        };

        const applyLoadedData = (data) => {
            if (!data) {
                loadPage(0);
                dataLoaded = true;
                return;
            }
            const content = data.data ? data.data : data; // Handle both wrapped and unwrapped
            if (content && typeof content === 'object') {
                pages = Array.isArray(content.pages) ? content.pages : [null];
                const pageIndex = content.currentPageIndex || 0;
                loadPage(pageIndex >= pages.length ? Math.max(0, pages.length - 1) : pageIndex);
            } else {
                loadPage(0);
            }
            dataLoaded = true;
        };

        // --- Data Conflict Modal Elements ---
        const conflictModalElement = document.getElementById('data-conflict-modal');
        const conflictModal = new bootstrap.Modal(conflictModalElement);
        const resolveLocalButton = document.getElementById('conflict-resolve-local');
        const resolveCloudButton = document.getElementById('conflict-resolve-cloud');
        const localTimestampEl = document.getElementById('conflict-local-timestamp');
        const cloudTimestampEl = document.getElementById('conflict-cloud-timestamp');
        const localBadgeEl = document.getElementById('conflict-local-badge');
        const cloudBadgeEl = document.getElementById('conflict-cloud-badge');


        // --- NEW, ROBUST AUTH HANDLING ---
        const setupAuthenticatedApp = async (session) => {
            currentUser = session.user;
            const localKey = `gmemo-user-data-${currentUser.id}`;
            const guestKey = 'gmemo-local-data';

            // --- CONFLICT/MIGRATION CHECK (Highest Priority) ---
            const guestDataString = localStorage.getItem(guestKey);
            const userDataString = localStorage.getItem(localKey);

            if (guestDataString) {
                if (!userDataString) {
                    // --- SCENARIO 1: New user with previous offline work (MIGRATION) ---
                    console.log("Migrating offline guest data to new user account...");
                    localStorage.setItem(localKey, guestDataString);
                    localStorage.removeItem(guestKey);
                    // Data is now migrated. The flow will continue to the "Normal Launch" path below.
                } else {
                    // --- SCENARIO 2: Existing user with previous offline work (CONFLICT) ---
                    const guestData = JSON.parse(guestDataString);
                    const userData = JSON.parse(userDataString);
                    const guestDate = new Date(guestData.lastModified);
                    const userDate = new Date(userData.lastModified);

                    if (guestDate > userDate) {
                        // Offline data is newer, show the conflict modal and PAUSE execution.
                        console.log("Conflict detected: Offline data is newer than cloud data.");
                        
                        const userChoice = new Promise(resolve => {
                            resolveLocalButton.onclick = () => {
                                console.log("User chose to keep local data.");
                                localStorage.setItem(localKey, guestDataString);
                                localStorage.removeItem(guestKey);
                                conflictModal.hide();
                                resolve();
                            };

                            resolveCloudButton.onclick = () => {
                                console.log("User chose to load from cloud.");
                                localStorage.removeItem(guestKey);
                                conflictModal.hide();
                                resolve();
                            };
                        });
                        
                        hideLoader();
                        conflictModal.show();
                        await userChoice; // Wait here until the user clicks a button.
                        showLoader(); // Show loader again while we proceed.
                    } else {
                        // User data is newer or same, silently discard old guest data.
                        localStorage.removeItem(guestKey);
                    }
                }
            }

            // --- POST-MIGRATION/CONFLICT LOGIC ---
            // At this point, guest data is handled. We just need to check if user data exists locally.
            
            const finalUserDataString = localStorage.getItem(localKey);

            // Prepare the main app UI structure
            userEmailDisplay.textContent = currentUser.email;
            logoutButton.classList.remove('d-none');
            showLoginButton.classList.add('d-none');
            authContainer.classList.add('d-none');
            appContainer.classList.remove('d-none');
            resizeCanvas();

            if (finalUserDataString) {
                // --- NORMAL LAUNCH or POST-MIGRATION ---
                // Data exists locally, so load it instantly.
                console.log("Loading data from local storage...");
                applyLoadedData(JSON.parse(finalUserDataString));
                hideLoader(); // Hide loader immediately
                
                // Sync in the background
                setupRealtimeSubscription();
                syncWithSupabase();

            } else {
                // --- TRUE FIRST LOGIN on a new device ---
                // No local data exists. We must wait for the first sync.
                console.log("First login on this device. Performing initial sync...");
                
                await syncWithSupabase(); // This fetches from cloud and saves to local storage

                // Now that local storage is populated, load it.
                const localData = loadNotesLocally(localKey);
                applyLoadedData(localData);
                hideLoader(); // Hide loader only after data is loaded and rendered.

                setupRealtimeSubscription();
            }
        };

        const setupLocalApp = async () => {
            currentUser = null;
            dataLoaded = false;

            const localKey = 'gmemo-local-data';
            const localDataString = localStorage.getItem(localKey);

            if (localDataString) {
                // Existing offline user, load as usual.
                applyLoadedData(loadNotesLocally(localKey));
            } else {
                // New offline user, try to load the welcome screen.
                try {
                    const response = await fetch('firstscreen.json');
                    if (!response.ok) throw new Error('Welcome screen file not found.');
                    let firstScreenData = await response.json();

                    // Handle both wrapped (exported) and direct canvas data formats
                    if (firstScreenData.data && firstScreenData.data.pages && firstScreenData.data.pages[0]) {
                        firstScreenData = firstScreenData.data.pages[0];
                    }

                    // Load the welcome data onto the canvas and save it.
                    pages = [firstScreenData];
                    currentPageIndex = 0;
                    loadPage(0);
                    saveNotesLocally(); // This populates localStorage for the next visit.
                    dataLoaded = true;
                } catch (e) {
                    console.warn(e.message, "Starting with a blank canvas instead.");
                    // Fallback to a blank canvas if fetch fails.
                    applyLoadedData(null);
                }
            }

            // UI Updates for local state
            userEmailDisplay.textContent = "Оффлайн";
            logoutButton.classList.add('d-none');
            showLoginButton.classList.remove('d-none');

            authContainer.classList.add('d-none');
            appContainer.classList.remove('d-none');

            resizeCanvas();
            hideLoader();
        };

        const setupLoginPage = () => {
            if (realtimeChannel) {
                supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            currentUser = null;
            authContainer.classList.remove('d-none');
            appContainer.classList.add('d-none');
            pages = [null];
            currentPageIndex = 0;
            dataLoaded = false;
            hideLoader();
        };

        const initializeApp = () => {
            showLoader();
            // The onAuthStateChange listener below will handle the rest,
            // firing immediately with a cached session if available,
            // or after the user logs in.
        };

        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') { 
                await setupAuthenticatedApp(session); 
            } else if (event === 'SIGNED_OUT') { 
                // When there's no session, show the login page.
                // The login page has an "offline" button that calls setupLocalApp.
                setupLoginPage(); 
            }
        });

        initializeApp();

        // --- Event Listeners for new buttons ---
        offlineButton.addEventListener('click', setupLocalApp);
        showLoginButton.addEventListener('click', setupLoginPage);

        // --- Canvas & App Logic ---
        const saveState = () => { 
            if (historyLock || isApplyingRemoteChange) return;
            saveIndicator.classList.remove('saved');
            saveIndicator.classList.add('unsaved');
            redoStack = []; 
            const state = fabricCanvas.toJSON(['isLink', 'url', 'uuid']);
            state.viewportTransform = fabricCanvas.viewportTransform;
            history.push(state); 
            updateHistoryButtons(); 
            
            // ALWAYS save locally immediately.
            saveNotesLocally();

            // If online, trigger a debounced save to the cloud.
            if (currentUser) {
                debouncedSave(); 
            }
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
                    setActiveTool(null);
                });
            } else {
                fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                fabricCanvas.renderAll();
                resetHistory();
                historyLock = false;
                setActiveTool(null);
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

        const debouncedSetCoords = _.debounce(() => {
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject) {
                activeObject.setCoords();
                fabricCanvas.renderAll();
            }
        }, 150);

        fabricCanvas.on('mouse:wheel', function(opt) {
            isZoomedToFit = false; // --- NEW: Reset showAll state on manual zoom ---
            if (!opt.e.altKey) return;
            opt.e.preventDefault();
            opt.e.stopPropagation();
            const delta = opt.e.deltaY;
            let zoom = fabricCanvas.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
            this.requestRenderAll(); // Force a re-render after zooming
            updateZoomIndicator(); // --- NEW: Show zoom level ---
            // --- FIX: Recalculate controls after zooming ---
            debouncedSetCoords();
        });

        fabricCanvas.on('mouse:down', function(opt) {
            // Eyedropper logic
            if (currentTool === 'eyedropper') {
                // Get the correct event object for coordinates (mouse vs. touch)
                const pointerEvent = opt.e.touches ? opt.e.touches[0] : opt.e;

                // Use the lower canvas element where the actual drawing resides
                const canvasEl = fabricCanvas.lowerCanvasEl;
                const canvasRect = canvasEl.getBoundingClientRect();
                
                // Calculate coordinates relative to the canvas element's CSS dimensions
                const x = Math.round(pointerEvent.clientX - canvasRect.left);
                const y = Math.round(pointerEvent.clientY - canvasRect.top);

                // Account for retina scaling to get coordinates on the backing store
                const scale = window.devicePixelRatio || 1;
                const scaledX = x * scale;
                const scaledY = y * scale;

                // Get context and pixel data from the correct coordinates
                const ctx = canvasEl.getContext('2d');
                const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data;

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

            if (currentTool === 'paste') {
                const clipboardData = localStorage.getItem('gmemoClipboard');
                if (clipboardData) {
                    const objectJSON = JSON.parse(clipboardData);
                    const pointer = fabricCanvas.getPointer(opt.e);

                    fabric.util.enlivenObjects([objectJSON], function(objects) {
                        if (objects.length > 0) {
                            const pastedObject = objects[0];
                            
                            // --- FIX: Assign new UUIDs to all objects being pasted ---
                            const assignNewUuids = (obj) => {
                                obj.uuid = crypto.randomUUID();
                                if (obj.forEachObject) {
                                    obj.forEachObject(assignNewUuids);
                                }
                            };
                            assignNewUuids(pastedObject);

                            pastedObject.set({
                                left: pointer.x,
                                top: pointer.y,
                                originX: 'center',
                                originY: 'center',
                                evented: true,
                            });

                            fabricCanvas.add(pastedObject);
                            pastedObject.setCoords();
                            fabricCanvas.setActiveObject(pastedObject);
                            fabricCanvas.renderAll();
                            broadcastOperation({ type: 'object:added', data: pastedObject.toJSON(['uuid']) });
                            saveState();
                        }
                    }, 'fabric');
                }
                // Deactivate paste mode after pasting once
                setActiveTool(null);
                return;
            }

            if (opt.e.altKey) {
                isPanning = true;
                fabricCanvas.selection = false;
                lastPosX = opt.e.clientX;
                lastPosY = opt.e.clientY;
                fabricCanvas.setCursor('grabbing');
            } else if ((currentTool === 'text' || currentTool === 'voice') && !opt.target) {
                isCreatingText = true;
                const pointer = fabricCanvas.getPointer(opt.e);
                textCreationInfo = {
                    startX: pointer.x,
                    startY: pointer.y,
                    type: currentTool
                };
            } else if (['line', 'arrow', 'rect', 'circle'].includes(currentTool) && !opt.target) {
                isDrawingShape = true;
                const pointer = fabricCanvas.getPointer(opt.e);
                startX = pointer.x;
                startY = pointer.y;
                const color = colorPickers[0].value;
                const width = parseInt(lineWidthSliders[0].value, 10);

                switch (currentTool) {
                    case 'line':
                        shapeInProgress = new fabric.Line([startX, startY, startX, startY], { stroke: color, strokeWidth: width, uuid: crypto.randomUUID() });
                        break;
                    case 'arrow':
                        shapeInProgress = createArrow(startX, startY, startX, startY, color, width);
                        shapeInProgress.uuid = crypto.randomUUID(); // Assign UUID to the group
                        break;
                    case 'rect':
                        shapeInProgress = new fabric.Rect({ left: startX, top: startY, width: 0, height: 0, fill: 'transparent', stroke: color, strokeWidth: width, uuid: crypto.randomUUID() });
                        break;
                    case 'circle':
                        shapeInProgress = new fabric.Ellipse({ left: startX, top: startY, rx: 0, ry: 0, fill: 'transparent', stroke: color, strokeWidth: width, uuid: crypto.randomUUID() });
                        break;
                }
                if (shapeInProgress) {
                    fabricCanvas.add(shapeInProgress);
                }
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
            } else if (isCreatingText && textCreationInfo && !isPanning) {
                const pointer = fabricCanvas.getPointer(opt.e);
                const endX = pointer.x;
                const endY = pointer.y;

                // If shape doesn't exist, create it
                if (!shapeInProgress) {
                    // Only start drawing if moved beyond a small threshold
                    if (Math.abs(endX - textCreationInfo.startX) > 5 || Math.abs(endY - textCreationInfo.startY) > 5) {
                        shapeInProgress = new fabric.Rect({
                            left: textCreationInfo.startX,
                            top: textCreationInfo.startY,
                            width: 0,
                            height: 0,
                            fill: 'rgba(0, 123, 255, 0.2)', // Semi-transparent fill
                            stroke: 'rgba(0, 123, 255, 0.7)', // Dashed border
                            strokeDashArray: [5, 5],
                            strokeWidth: 1,
                            selectable: false,
                            evented: false,
                        });
                        fabricCanvas.add(shapeInProgress);
                    }
                }

                // Update shape dimensions if it exists
                if (shapeInProgress) {
                    shapeInProgress.set({
                        width: Math.abs(endX - textCreationInfo.startX),
                        height: Math.abs(endY - textCreationInfo.startY),
                        left: endX < textCreationInfo.startX ? endX : textCreationInfo.startX,
                        top: endY < textCreationInfo.startY ? endY : textCreationInfo.startY
                    });
                    fabricCanvas.renderAll();
                }
            } else if (isDrawingShape && shapeInProgress) {
                const pointer = fabricCanvas.getPointer(opt.e);
                const endX = pointer.x;
                const endY = pointer.y;

                switch (currentTool) {
                    case 'line':
                        shapeInProgress.set({ x2: endX, y2: endY });
                        break;
                    case 'arrow':
                        fabricCanvas.remove(shapeInProgress);
                        shapeInProgress = createArrow(startX, startY, endX, endY, shapeInProgress.stroke, shapeInProgress.strokeWidth);
                        fabricCanvas.add(shapeInProgress);
                        break;
                    case 'rect':
                        shapeInProgress.set({
                            width: Math.abs(endX - startX),
                            height: Math.abs(endY - startY),
                            left: endX < startX ? endX : startX,
                            top: endY < startY ? endY : startY
                        });
                        break;
                    case 'circle':
                        shapeInProgress.set({
                            rx: Math.abs(endX - startX) / 2,
                            ry: Math.abs(endY - startY) / 2,
                            left: endX < startX ? endX : startX,
                            top: endY < startY ? endY : startY,
                            originX: 'left',
                            originY: 'top'
                        });
                        break;
                }
                fabricCanvas.renderAll();
            }
        });

        fabricCanvas.on('mouse:up', function(opt) {
            if (isPanning && !isTouching) {
                isPanning = false;
                isZoomedToFit = false; // --- NEW: Reset showAll state on manual pan ---
                fabricCanvas.selection = true;
                fabricCanvas.setCursor('default');
                // --- FIX: Recalculate controls on pan end ---
                const activeObject = fabricCanvas.getActiveObject();
                if (activeObject) {
                    activeObject.setCoords();
                }
                fabricCanvas.renderAll();
                saveState(); // Save state after panning
            } else if (isCreatingText && !isPanning) {
                // If we were drawing a selection box, remove it
                if (shapeInProgress) {
                    fabricCanvas.remove(shapeInProgress);
                }

                const wasDrag = shapeInProgress && shapeInProgress.width > 5 && shapeInProgress.height > 5;
                const creationType = textCreationInfo.type;

                if (creationType === 'text') {
                    let textObject;
                    const newUuid = crypto.randomUUID();
                    if (wasDrag) {
                        // Dragged - create a Textbox
                        textObject = new fabric.Textbox('', {
                            left: shapeInProgress.left,
                            top: shapeInProgress.top,
                            width: shapeInProgress.width,
                            height: shapeInProgress.height,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            uuid: newUuid
                        });
                    } else {
                        // Clicked - create an IText
                        textObject = new fabric.IText('', {
                            left: textCreationInfo.startX,
                            top: textCreationInfo.startY,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            originX: 'center',
                            originY: 'center',
                            uuid: newUuid
                        });
                    }
                    fabricCanvas.add(textObject);
                    fabricCanvas.setActiveObject(textObject);
                    textObject.enterEditing();
                    textObject.selectAll();
                    
                    broadcastOperation({ type: 'object:added', data: textObject.toJSON(['uuid']) });
                    setActiveTool('select');

                } else if (creationType === 'voice') {
                    if (!SpeechRecognition) {
                        alert("Ваш браузер не поддерживает голосовой ввод.");
                        setActiveTool('select');
                    } else {
                        // Store the creation info for the voice modal to use
                        voiceInputPosition = wasDrag 
                            ? { x: shapeInProgress.left, y: shapeInProgress.top, width: shapeInProgress.width, height: shapeInProgress.height, isTextbox: true }
                            : { x: textCreationInfo.startX, y: textCreationInfo.startY, isTextbox: false };
                        
                        voiceTextResult.value = '';
                        textBeforeCurrentSession = '';
                        voiceModal.show();
                    }
                }

                // Reset state
                isCreatingText = false;
                textCreationInfo = null;
                shapeInProgress = null;

            } else if (isDrawingShape) {
                isDrawingShape = false;
                if (shapeInProgress) {
                    shapeInProgress.setCoords(); // Finalize coordinates
                    broadcastOperation({ type: 'object:added', data: shapeInProgress.toJSON(['uuid']) });
                    saveState();
                }
                shapeInProgress = null;
            } else if (!isTouching && currentTool === null && opt.target && opt.target.isLink && !opt.target.isEditing) {
                window.open(opt.target.url, '_blank');
            }
        });

        const createArrow = (fromX, fromY, toX, toY, color, width) => {
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const headLength = width * 4;

            const line = new fabric.Line([fromX, fromY, toX, toY], {
                stroke: color,
                strokeWidth: width,
                selectable: false,
                evented: false,
            });

            const arrowhead = new fabric.Triangle({
                left: toX,
                top: toY,
                originX: 'center',
                originY: 'center',
                width: headLength,
                height: headLength,
                fill: color,
                angle: angle * (180 / Math.PI) + 90,
                selectable: false,
                evented: false,
            });

            return new fabric.Group([line, arrowhead], {
                left: fromX,
                top: fromY,
                stroke: color, // Store for redraw
                strokeWidth: width, // Store for redraw
            });
        };

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
                const touchCenter = getTouchCenter(e.touches);
                const currentDist = getTouchDistance(e.touches);
                const zoomRatio = currentDist / pinchStartDistance;
                const newZoom = pinchStartZoom * zoomRatio;

                // Рассчитываем смещение для панорамирования
                const deltaX = touchCenter.x - lastPosX;
                const deltaY = touchCenter.y - lastPosY;

                // Применяем и зум, и панорамирование одновременно
                fabricCanvas.zoomToPoint(new fabric.Point(touchCenter.x, touchCenter.y), newZoom);
                fabricCanvas.relativePan(new fabric.Point(deltaX, deltaY));
                updateZoomIndicator(); // --- NEW: Show zoom level on touch zoom ---
                
                fabricCanvas.requestRenderAll();

                // Обновляем последние позиции для следующего шага
                lastPosX = touchCenter.x;
                lastPosY = touchCenter.y;
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            if (e.touches.length === 0 && e.changedTouches.length === 1 && !isPanning && touchDuration < 250) {
                 if (currentTool === null && lastTouchTarget && lastTouchTarget.isLink) { window.open(lastTouchTarget.url, '_blank'); }
            }
            if (isPanning && e.touches.length < 2) {
                isPanning = false;
                isZoomedToFit = false; // --- NEW: Reset showAll state on manual touch pan/zoom ---
                fabricCanvas.selection = (currentTool === 'select'); // Restore selection only if select tool is active
                if (drawingModeWasActive) {
                    fabricCanvas.isDrawingMode = true;
                    drawingModeWasActive = false;
                }
                // --- FIX: Recalculate controls on pan/zoom end ---
                const activeObject = fabricCanvas.getActiveObject();
                if (activeObject) {
                    activeObject.setCoords();
                }
                fabricCanvas.renderAll();
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
            const state = initialState || fabricCanvas.toJSON(['isLink', 'url', 'uuid']); // --- MODIFIED: Include uuid
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
                    // BIG CHANGE: When undoing, we must inform others.
                    // The simplest robust way is to treat it as a full clear and re-add.
                    broadcastOperation({ type: 'objects:cleared' });
                    const objects = fabricCanvas.getObjects();
                    if (objects.length > 0) {
                        objects.forEach(obj => {
                             broadcastOperation({ type: 'object:added', data: obj.toJSON(['uuid']) });
                        });
                    }
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
                    // Treat redo as a full clear and re-add as well
                     broadcastOperation({ type: 'objects:cleared' });
                    const objects = fabricCanvas.getObjects();
                    if (objects.length > 0) {
                        objects.forEach(obj => {
                             broadcastOperation({ type: 'object:added', data: obj.toJSON(['uuid']) });
                        });
                    }
                });
            }
        };

        historyButtons.undo.addEventListener('click', undo);
        historyButtons.mobileUndo.addEventListener('click', undo);
        historyButtons.redo.addEventListener('click', redo);
        historyButtons.mobileRedo.addEventListener('click', redo);
        historyButtons.showAll.addEventListener('click', showAll);

        // --- Grid Logic ---
        const drawGrid = () => {
            const zoom = fabricCanvas.getZoom();
            const vpt = fabricCanvas.viewportTransform;
            const scaledGridSpacing = gridSpacing * zoom;
            if (scaledGridSpacing <= 0) return; // Prevent infinite loops on zero/negative zoom
            const width = fabricCanvas.getWidth();
            const height = fabricCanvas.getHeight();
            const ctx = fabricCanvas.getContext();

            ctx.save();
            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 1;

            // Calculate the offset based on the viewport transform
            const xOffset = vpt[4] % scaledGridSpacing;
            const yOffset = vpt[5] % scaledGridSpacing;

            // Draw vertical lines
            for (let x = xOffset; x < width; x += scaledGridSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // Draw horizontal lines
            for (let y = yOffset; y < height; y += scaledGridSpacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            ctx.restore();
        };

        const toggleGrid = () => {
            isGridVisible = !isGridVisible;
            historyButtons.grid.classList.toggle('active', isGridVisible);
            if (isGridVisible) {
                fabricCanvas.on('after:render', drawGrid);
                fabricCanvas.renderAll();
            } else {
                fabricCanvas.off('after:render', drawGrid);
                fabricCanvas.renderAll(); // Re-render to clear the grid
            }
        };

        historyButtons.grid.addEventListener('click', toggleGrid);

        const saveCurrentPage = () => {
            const pageData = fabricCanvas.toJSON(['isLink', 'url', 'uuid']); // --- MODIFIED: Include uuid
            pageData.viewportTransform = fabricCanvas.viewportTransform;
            pages[currentPageIndex] = pageData;
        };
        const updatePageIndicator = () => { pageControls.indicator.textContent = `Стр. ${currentPageIndex + 1} / ${pages.length}`; };
        
        const setActiveTool = (tool) => {
            // --- NEW: Toggle logic ---
            if (tool === currentTool) {
                tool = null; // If clicking the same tool, deactivate it
            }

            currentTool = tool;
            const isDrawTool = tool === 'draw' || tool === 'marker';
            const isShapeTool = ['line', 'arrow', 'rect', 'circle'].includes(tool);

            // Drawing mode is only for pencil and marker
            fabricCanvas.isDrawingMode = isDrawTool;

            // Configure canvas based on tool
            const isSelectMode = tool === 'select';
            fabricCanvas.selection = isSelectMode;
            fabricCanvas.defaultCursor = 'default';
            fabricCanvas.hoverCursor = 'default';


            // When not in select mode, ensure nothing is selected
            if (!isSelectMode) {
                fabricCanvas.discardActiveObject();
            }

            // Set object interactivity based on the current tool
            fabricCanvas.forEachObject(obj => {
                // An object can be selected only if the select tool is active.
                const isSelectable = (tool === 'select');
                // An object can fire events (like for links) if we are in select or null mode.
                const isEvented = isSelectable || (tool === null && obj.isLink);
                obj.set({ 
                    selectable: isSelectable,
                    evented: isEvented 
                });
            });

            if (tool === 'eyedropper' || tool === 'paste') {
                fabricCanvas.defaultCursor = 'crosshair';
                fabricCanvas.hoverCursor = 'crosshair';
            }
            
            fabricCanvas.renderAll();


            updateBrushSettings(); // Centralized brush configuration

            // Update button states
            toolButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });
            
            // Handle shapes dropdown button state
            const shapesDropdownBtn = document.getElementById('shapes-dropdown');
            if (shapesDropdownBtn) {
                shapesDropdownBtn.classList.toggle('active', isShapeTool);
            }
            
            if (mobileShapesToggle) {
                mobileShapesToggle.classList.toggle('active', isShapeTool);
            }

            // Manage mobile panels
            if (isDrawTool) {
                mobileDrawOptions.classList.add('active');
                if (mobileShapesOptions.classList.contains('active')) {
                    toggleMobilePanel(mobileShapesOptions);
                }
                 if (mobileActionsOptions.classList.contains('active')) {
                    toggleMobilePanel(mobileActionsOptions);
                }
            } else {
                if (mobileDrawOptions.classList.contains('active')) {
                    mobileDrawOptions.classList.remove('active');
                }
            }
            
            updateMobileCanvasPadding();
            setTimeout(updateMobileCanvasPadding, 210);
        };

        function showAll() {
            fabricCanvas.discardActiveObject();
            const objects = fabricCanvas.getObjects();
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();

            // If already zoomed to fit, or if there are no objects, reset the view.
            if (isZoomedToFit || objects.length === 0) {
                fabric.util.animate({
                    startValue: { zoom: fabricCanvas.getZoom(), x: fabricCanvas.viewportTransform[4], y: fabricCanvas.viewportTransform[5] },
                    endValue: { zoom: 1, x: 0, y: 0 },
                    duration: 500,
                    easing: fabric.util.ease.easeInOutQuint,
                    onChange: (value) => {
                        fabricCanvas.zoomToPoint({ x: canvasWidth / 2, y: canvasHeight / 2 }, value.zoom);
                        fabricCanvas.viewportTransform[4] = value.x;
                        fabricCanvas.viewportTransform[5] = value.y;
                        fabricCanvas.requestRenderAll();
                        updateZoomIndicator(); // --- NEW: Show zoom level during animation ---
                    },
                    onComplete: () => {
                        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                        isZoomedToFit = false;
                        saveState();
                    }
                });
                return;
            }

            const group = new fabric.Group(objects);
            const aabb = group.getBoundingRect();

            // Prevent division by zero or Infinity scale for tiny/zero-dimension objects
            if (aabb.width < 1 || aabb.height < 1) {
                fabric.util.animate({
                    startValue: { zoom: fabricCanvas.getZoom(), x: fabricCanvas.viewportTransform[4], y: fabricCanvas.viewportTransform[5] },
                    endValue: { zoom: 1, x: (canvasWidth / 2) - (aabb.left + aabb.width / 2), y: (canvasHeight / 2) - (aabb.top + aabb.height / 2) },
                    duration: 500,
                    easing: fabric.util.ease.easeInOutQuint,
                    onChange: (value) => {
                        fabricCanvas.zoomToPoint({ x: canvasWidth / 2, y: canvasHeight / 2 }, value.zoom);
                        fabricCanvas.viewportTransform[4] = value.x;
                        fabricCanvas.viewportTransform[5] = value.y;
                        fabricCanvas.requestRenderAll();
                        updateZoomIndicator(); // --- NEW: Show zoom level during animation ---
                    },
                    onComplete: () => {
                        isZoomedToFit = true;
                        saveState();
                    }
                });
                return;
            }

            const scale = Math.min(canvasWidth / aabb.width, canvasHeight / aabb.height) * 0.95;
            const targetCenter = group.getCenterPoint();
            
            fabric.util.animate({
                startValue: { zoom: fabricCanvas.getZoom(), x: fabricCanvas.viewportTransform[4], y: fabricCanvas.viewportTransform[5] },
                endValue: { 
                    zoom: scale, 
                    x: (canvasWidth / 2) - (targetCenter.x * scale),
                    y: (canvasHeight / 2) - (targetCenter.y * scale)
                },
                duration: 500,
                easing: fabric.util.ease.easeInOutQuint,
                                    onChange: (value) => {
                                        fabricCanvas.zoomToPoint({ x: canvasWidth / 2, y: canvasHeight / 2 }, value.zoom);
                                        fabricCanvas.viewportTransform[4] = value.x;
                                        fabricCanvas.viewportTransform[5] = value.y;
                                        fabricCanvas.requestRenderAll();
                                        updateZoomIndicator(); // --- NEW: Show zoom level during animation ---
                                    },
                                    onComplete: () => {
                                        isZoomedToFit = true;
                                        saveState();                }
            });
        }

        function exportCanvasPNG() {
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

        function exportCanvasSVG() {
            const svg = fabricCanvas.toSVG();
            const blob = new Blob([svg], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `gMemo-page-${currentPageIndex + 1}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        const groupButton = document.getElementById('group-button');
        const ungroupButton = document.getElementById('ungroup-button');
        const mobileGroupButton = document.getElementById('mobile-group-button');
        const mobileUngroupButton = document.getElementById('mobile-ungroup-button');

        // --- NEW: Combined function to handle selection changes ---
        const handleSelectionChange = (e) => {
            // First, update the state of the group/ungroup buttons (existing logic)
            updateGroupButtons(e);

            // Then, bring the selected object to the front, but ONLY if the select tool is active
            if (currentTool === 'select' && e.target) {
                const activeObject = e.target;
                activeObject.bringToFront();
                fabricCanvas.renderAll();
            }
        };

        // Function to handle group functionality
        const handleGroup = () => {
            const activeSelection = fabricCanvas.getActiveObject();
            if (activeSelection && activeSelection.type === 'activeSelection') {
                const oldObjects = activeSelection.getObjects();
                const oldUuids = oldObjects.map(o => o.uuid);
                
                const group = activeSelection.toGroup();
                group.uuid = crypto.randomUUID(); // Assign UUID to the new group
                fabricCanvas.renderAll();
                
                broadcastOperation({ type: 'object:removed', data: { uuids: oldUuids } });
                broadcastOperation({ type: 'object:added', data: group.toJSON(['uuid']) });
                saveState();
            }
        };

        // Function to handle ungroup functionality
        const handleUngroup = () => {
            const activeGroup = fabricCanvas.getActiveObject();
            if (activeGroup && activeGroup.type === 'group') {
                const groupUuid = activeGroup.uuid;
                // Ungrouping in fabric.js is async, but toActiveSelection is sync
                const newObjects = activeGroup.toActiveSelection().getObjects();
                fabricCanvas.renderAll();
                
                broadcastOperation({ type: 'object:removed', data: { uuids: [groupUuid] } });
                newObjects.forEach(obj => {
                    // We need to ensure the objects have their UUIDs before broadcasting
                    if (!obj.uuid) {
                        obj.uuid = crypto.randomUUID();
                    }
                    broadcastOperation({ type: 'object:added', data: obj.toJSON(['uuid']) });
                });
                saveState();
            }
        };

        // --- UNIFIED TOOL CLICK HANDLER ---
        document.body.addEventListener('click', (e) => {
            const toolButton = e.target.closest('[data-tool]');
            if (!toolButton) return;

            e.preventDefault();
            const tool = toolButton.dataset.tool;

            // Close dropdown if the button is inside one
            const dropdownToggle = toolButton.closest('.dropdown-menu')?.parentElement.querySelector('.dropdown-toggle');
            if (dropdownToggle) {
                const dropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
                if (dropdown) {
                    dropdown.hide();
                }
            }

            // --- Action Tools (perform an action and exit) ---
            switch (tool) {
                case 'delete':
                    const activeObjects = fabricCanvas.getActiveObjects();
                    if (activeObjects.length > 0) {
                        const uuidsToRemove = activeObjects.map(o => o.uuid);
                        fabricCanvas.remove(...activeObjects);
                        fabricCanvas.discardActiveObject().renderAll();
                        broadcastOperation({ type: 'object:removed', data: { uuids: uuidsToRemove } });
                        saveState();
                    }
                    return;
                case 'group':
                    handleGroup();
                    return;
                case 'ungroup':
                    handleUngroup();
                    return;
                case 'copy':
                    const activeObject = fabricCanvas.getActiveObject();
                    if (activeObject) {
                        activeObject.clone(function(cloned) {
                            const serialized = cloned.toJSON(['isLink', 'url', 'uuid']);
                            localStorage.setItem('gmemoClipboard', JSON.stringify(serialized));
                        });
                    }
                    return;
                case 'link':
                    const url = prompt("Введите URL ссылки:", "https://");
                    if (!url) return;
                    const text = prompt("Введите текст для ссылки:", "Моя ссылка");
                    if (!text) return;
                    const linkText = new fabric.IText(text, {
                        left: 150,
                        top: 150,
                        fontSize: 24,
                        fill: '#007bff',
                        underline: true,
                        fontFamily: 'Arial',
                        isLink: true,
                        url: url,
                        uuid: crypto.randomUUID()
                    });
                    fabricCanvas.add(linkText);
                    broadcastOperation({ type: 'object:added', data: linkText.toJSON(['uuid']) });
                    saveState();
                    return;
                case 'grid-mobile':
                    toggleGrid();
                    return;
                case 'show-all-mobile':
                    showAll();
                    return;
            }

            // --- Mode Tools (toggle a state) ---
            if (tool === 'paste') {
                if (localStorage.getItem('gmemoClipboard')) {
                    setActiveTool('paste');
                }
            } else {
                // Standard toggle logic: calling with the current tool will deactivate it.
                setActiveTool(tool);
            }
        });


        // Add event listeners for mobile group/ungroup buttons
        if (mobileGroupButton) {
            mobileGroupButton.addEventListener('click', (e) => {
                e.preventDefault();
                handleGroup();
            });
        }

        if (mobileUngroupButton) {
            mobileUngroupButton.addEventListener('click', (e) => {
                e.preventDefault();
                handleUngroup();
            });
        }

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

        imageUploadInputs.forEach(input => { input.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (f) => { fabric.Image.fromURL(f.target.result, (img) => { img.scaleToWidth(200); img.uuid = crypto.randomUUID(); fabricCanvas.add(img); broadcastOperation({ type: 'object:added', data: img.toJSON(['uuid']) }); saveState(); }); }; reader.readAsDataURL(file); e.target.value = ''; }); });
        
        svgUploadInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (f) => {
                    const svgString = f.target.result;
                    fabric.loadSVGFromString(svgString, (objects, options) => {
                        // Recursive function to assign UUIDs to all nested objects
                        const assignNewUuids = (obj) => {
                            obj.uuid = crypto.randomUUID();
                            if (obj.forEachObject) {
                                obj.forEachObject(assignNewUuids);
                            }
                        };

                        const group = fabric.util.groupSVGElements(objects, options);
                        assignNewUuids(group); // Assign UUIDs to the group and all its children

                        // Position and scale it to a sensible default
                        group.scaleToWidth(300);
                        group.set({
                            left: 150,
                            top: 150
                        });

                        fabricCanvas.add(group);
                        group.setCoords();
                        fabricCanvas.setActiveObject(group);
                        fabricCanvas.renderAll();

                        broadcastOperation({ type: 'object:added', data: group.toJSON(['uuid']) });
                        saveState();
                    });
                };
                reader.readAsText(file);
                e.target.value = ''; // Reset input to allow re-uploading the same file
            });
        });

        window.addEventListener('keydown', (e) => {
            // Do not interfere with text editing
            if (fabricCanvas.getActiveObject()?.isEditing) {
                return;
            }

            // Handle Undo/Redo with Ctrl key
            if (e.ctrlKey) {
                if (e.code === 'KeyZ') { // Use e.code for layout-independent key recognition
                    e.preventDefault();
                    undo();
                } else if (e.code === 'KeyY') { // Use e.code for layout-independent key recognition
                    e.preventDefault();
                    redo();
                }
                return; // Exit after handling Ctrl combinations
            }

            // Handle Delete/Backspace for objects
            if (e.key === 'Delete' || e.key === 'Backspace') {
                document.querySelector('[data-tool="delete"]').click();
            }
        });

        const onObjectModified = _.debounce((e) => {
            if (!e.target || isApplyingRemoteChange) return;
            const target = e.target;
            
            const broadcastPayload = (obj) => {
                broadcastOperation({
                    type: 'object:modified',
                    data: {
                        uuid: obj.uuid,
                        updates: {
                            left: obj.left,
                            top: obj.top,
                            scaleX: obj.scaleX,
                            scaleY: obj.scaleY,
                            angle: obj.angle,
                            skewX: obj.skewX,
                            skewY: obj.skewY,
                            flipX: obj.flipX,
                            flipY: obj.flipY,
                            // Include properties specific to object types
                            ...(obj.type === 'i-text' || obj.type === 'textbox' ? { text: obj.text, fill: obj.fill, fontSize: obj.fontSize, fontFamily: obj.fontFamily, underline: obj.underline } : {}),
                            ...(obj.type === 'rect' || obj.type === 'ellipse' || obj.type === 'line' ? { stroke: obj.stroke, strokeWidth: obj.strokeWidth } : {}),
                        }
                    }
                });
            };

            if (target.type === 'activeSelection') {
                 target.getObjects().forEach(broadcastPayload);
            } else {
                 broadcastPayload(target);
            }
            saveState();
        }, 100); // Debounce to avoid flooding with modification events

        fabricCanvas.on({
            'object:modified': onObjectModified,
        });

        // --- NEW: Assign UUID and broadcast newly created paths from free drawing ---
        fabricCanvas.on('path:created', function(e) {
            if (e.path) {
                e.path.uuid = crypto.randomUUID();
                broadcastOperation({ type: 'object:added', data: e.path.toJSON(['uuid']) });
                saveState();
            }
        });

        // --- NEW: Logic to enable/disable group/ungroup buttons ---
        const updateGroupButtons = () => {
            const activeObject = fabricCanvas.getActiveObject();
            if (groupButton && ungroupButton) {
                groupButton.disabled = !(activeObject && activeObject.type === 'activeSelection');
                ungroupButton.disabled = !(activeObject && activeObject.type === 'group');
            }
            // Also update mobile buttons if they exist
            if (mobileGroupButton && mobileUngroupButton) {
                mobileGroupButton.disabled = !(activeObject && activeObject.type === 'activeSelection');
                mobileUngroupButton.disabled = !(activeObject && activeObject.type === 'group');
            }
        };

        mobileGroupButton.addEventListener('click', handleGroup);
        mobileUngroupButton.addEventListener('click', handleUngroup);

        const handleObjectModified = (e) => {
            if (e.target) {
                e.target.bringToFront();
            }
            saveState();
        };

        fabricCanvas.on('object:modified', handleObjectModified);
        fabricCanvas.on('selection:created', handleSelectionChange);
        fabricCanvas.on('selection:updated', handleSelectionChange);
        fabricCanvas.on('selection:cleared', updateGroupButtons); // Cleared event doesn't need to move objects

        // --- NEW: Mobile Text Controls Logic ---
        const hideTextControls = () => {
            if (textControls.style.display !== 'none') {
                textControls.style.display = 'none';
            }
        };

        const showTextControls = (textObject) => {
            if (!textObject || !textObject.oCoords) {
                hideTextControls();
                return;
            }
            // Use the top-center coordinate of the object's bounding box
            const coord = textObject.oCoords.mt;
            
            // Position the controls
            textControls.style.left = `${coord.x}px`;
            textControls.style.top = `${coord.y}px`;
            textControls.style.display = 'flex';
        };

        fabricCanvas.on('text:editing:entered', (e) => {
            if (e.target) {
                showTextControls(e.target);
            }
        });

        fabricCanvas.on('text:editing:exited', hideTextControls);
        fabricCanvas.on('selection:cleared', hideTextControls);
        fabricCanvas.on('object:moving', (e) => {
            if (e.target.isEditing) showTextControls(e.target);
            else hideTextControls();
        });
        fabricCanvas.on('object:scaling', (e) => {
            if (e.target.isEditing) showTextControls(e.target);
        });
        fabricCanvas.on('mouse:wheel', hideTextControls); // Hide on zoom

        copyTextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox') && activeObject.isEditing) {
                const selectedText = activeObject.getSelectedText();
                if (selectedText) {
                    navigator.clipboard.writeText(selectedText).then(() => {
                        // Optional: show a brief confirmation
                    }).catch(err => console.error('Could not copy text: ', err));
                }
            }
        });

        pasteTextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox') && activeObject.isEditing) {
                navigator.clipboard.readText().then(textToPaste => {
                    if (textToPaste) {
                        // Manually handle text insertion for better control
                        const selectionStart = activeObject.selectionStart;
                        const selectionEnd = activeObject.selectionEnd;
                        const originalText = activeObject.text;

                        const newText = originalText.slice(0, selectionStart) + textToPaste + originalText.slice(selectionEnd);
                        
                        activeObject.set('text', newText);
                        
                        // Move cursor to the end of pasted text
                        const newCursorPos = selectionStart + textToPaste.length;
                        activeObject.setSelectionStart(newCursorPos);
                        activeObject.setSelectionEnd(newCursorPos);

                        fabricCanvas.renderAll();
                        activeObject.fire('changed'); // Manually fire changed event for history
                    }
                }).catch(err => console.error('Could not paste text: ', err));
            }
        });


        fabricCanvas.on('mouse:dblclick', (options) => { if (options.target) { if (options.target.isLink) { const target = options.target; const newText = prompt("Измените текст ссылки:", target.text); if (newText !== null) target.set('text', newText); const newUrl = prompt("Измените URL:", target.url); if (newUrl !== null) target.set('url', newUrl); fabricCanvas.renderAll(); } else if (options.target.type === 'i-text') { const target = options.target; target.enterEditing(); const selectionStart = target.getSelectionStartFromPointer(options.e); const start = target.findWordBoundaryLeft(selectionStart); const end = target.findWordBoundaryRight(selectionStart); target.setSelectionStart(start); target.setSelectionEnd(end); fabricCanvas.renderAll(); } } });

        // The beforeunload handler was here. It has been removed as per user request
        // to prevent the "Changes you made may not be saved" dialog.
        // The app's autosave functionality is considered sufficient.

        // --- Page Navigation with IMMEDIATE save & SYNC ---
        pageControls.prev.addEventListener('click', async () => {
            if (currentPageIndex > 0) {
                showLoader();
                saveCurrentPage(); // Save canvas of the page we are leaving
                const newPageIndex = currentPageIndex - 1;
                loadPage(newPageIndex); // Update local state and currentPageIndex
                broadcastOperation({ type: 'page:navigate', data: { newPageIndex } });
                if (currentUser) {
                    await saveNotesToSupabase(); // Save the new state with the correct index
                } else {
                    saveNotesLocally();
                }
                hideLoader();
            }
        });
        pageControls.next.addEventListener('click', async () => {
            if (currentPageIndex < pages.length - 1) {
                showLoader();
                saveCurrentPage(); // Save canvas of the page we are leaving
                const newPageIndex = currentPageIndex + 1;
                loadPage(newPageIndex); // Update local state and currentPageIndex
                broadcastOperation({ type: 'page:navigate', data: { newPageIndex } });
                if (currentUser) {
                    await saveNotesToSupabase();
                } else {
                    saveNotesLocally();
                }
                hideLoader();
            }
        });
        pageControls.add.addEventListener('click', async () => {
            showLoader();
            saveCurrentPage(); // Save canvas of the page we are leaving
            pages.push(null);
            const newPageIndex = pages.length - 1;
            loadPage(newPageIndex); // Update local state and currentPageIndex
            broadcastOperation({ type: 'page:add' });
            if (currentUser) {
                await saveNotesToSupabase();
            } else {
                saveNotesLocally();
            }
            hideLoader();
        });
        pageControls.delete.addEventListener('click', async () => {
            if (pages.length <= 1) {
                alert("Нельзя удалить последнюю страницу.");
                return;
            }
            if (confirm("Вы уверены, что хотите удалить эту страницу?")) {
                showLoader();
                const deletedPageIndex = currentPageIndex;
                pages.splice(currentPageIndex, 1);
                let newPageIndex = currentPageIndex;
                if (newPageIndex >= pages.length) {
                    newPageIndex = pages.length - 1;
                }
                loadPage(newPageIndex); // Update local state and currentPageIndex
                broadcastOperation({ type: 'page:delete', data: { deletedPageIndex, newPageIndex } });
                if (currentUser) {
                    await saveNotesToSupabase();
                } else {
                    saveNotesLocally();
                }
                hideLoader();
            }
        });
        pageControls.exportPng.addEventListener('click', exportCanvasPNG);
        pageControls.exportSvg.addEventListener('click', exportCanvasSVG);

        const exportFullNotes = () => {
            saveNotesLocally(); // Ensure the very last change is included and saved to localStorage
            const key = currentUser ? `gmemo-user-data-${currentUser.id}` : 'gmemo-local-data';
            const dataString = localStorage.getItem(key);

            if (!dataString) {
                alert("Нет данных для экспорта.");
                return;
            }

            const blob = new Blob([dataString], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `gMemo-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const importFullNotes = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm("Вы уверены, что хотите импортировать заметки? Это действие полностью заменит все текущие страницы. Рекомендуется сначала сделать экспорт.")) {
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // Basic validation
                    if (!importedData || !importedData.data || !Array.isArray(importedData.data.pages)) {
                        throw new Error("Неверный формат файла.");
                    }

                    showLoader();
                    // Replace current state
                    pages = importedData.data.pages;
                    let newPageIndex = importedData.data.currentPageIndex || 0;
                    if (newPageIndex >= pages.length) {
                        newPageIndex = Math.max(0, pages.length - 1);
                    }
                    currentPageIndex = newPageIndex;

                    // Reload the canvas with the new data FIRST
                    loadPage(currentPageIndex);

                    // Now, save the newly loaded state to local storage
                    saveNotesLocally(); 

                    // If logged in, also sync the new state to the cloud
                    if (currentUser) {
                        saveNotesToSupabase();
                    }
                    
                    hideLoader();
                    alert("Заметки успешно импортированы!");

                } catch (err) {
                    console.error("Error importing notes:", err);
                    alert(`Ошибка импорта: ${err.message}`);
                    hideLoader();
                } finally {
                    e.target.value = ''; // Reset input
                }
            };
            reader.readAsText(file);
        };

        exportJsonButton.addEventListener('click', exportFullNotes);
        jsonUploadInput.addEventListener('change', importFullNotes);

        // --- Navigator Tool Logic ---
        const toggleNavigatorMode = () => {
            isNavigatorMode = !isNavigatorMode;
            navigatorToolButton.classList.toggle('active', isNavigatorMode);
            mobileNavigatorToolButton.classList.toggle('active', isNavigatorMode);
            if (isNavigatorMode) {
                // Reset position every time the navigator is shown
                navigatorPanel.style.left = 'auto';
                navigatorPanel.style.top = 'auto';
                navigatorPanel.style.right = '20px';
                navigatorPanel.style.bottom = '20px';
            }
            navigatorPanel.classList.toggle('visible', isNavigatorMode);
        };

        const panToAdjacentScreen = (direction) => {
            if (!fabricCanvas) return;

            const screenWidth = canvasContainer.clientWidth;
            const screenHeight = canvasContainer.clientHeight;
            const vpt = fabricCanvas.viewportTransform;

            const startVpt = { x: vpt[4], y: vpt[5] };
            const endVpt = { x: vpt[4], y: vpt[5] };

            switch (direction) {
                case 'left':  endVpt.x += screenWidth;  break;
                case 'right': endVpt.x -= screenWidth;  break;
                case 'up':    endVpt.y += screenHeight; break;
                case 'down':  endVpt.y -= screenHeight; break;
            }

            fabric.util.animate({
                startValue: startVpt,
                endValue: endVpt,
                duration: 500,
                easing: fabric.util.ease.easeInOutQuint,
                onChange: (value) => {
                    // Directly mutate the transform array for performance
                    fabricCanvas.viewportTransform[4] = value.x;
                    fabricCanvas.viewportTransform[5] = value.y;
                    // Force a synchronous redraw on every animation frame to prevent flickering
                    fabricCanvas.renderAll();
                },
                onComplete: () => {
                    // Ensure the final state is perfectly set and saved
                    fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
                    isZoomedToFit = false; // --- NEW: Reset showAll state on pan ---
                    saveState();
                }
            });
        };

        navigatorToolButton.addEventListener('click', toggleNavigatorMode);
        mobileNavigatorToolButton.addEventListener('click', toggleNavigatorMode);
        navButtons.up.addEventListener('click', () => panToAdjacentScreen('up'));
        navButtons.down.addEventListener('click', () => panToAdjacentScreen('down'));
        navButtons.left.addEventListener('click', () => panToAdjacentScreen('left'));
        navButtons.right.addEventListener('click', () => panToAdjacentScreen('right'));


    } catch (e) {
        console.error("A critical error occurred in the application script:", e);
        alert("Произошла критическая ошибка. Пожалуйста, проверьте консоль разработчика.");
    }
});

// --- Helper to prevent accidental closure ---
// window.addEventListener('beforeunload', (e) => {
//     if (document.getElementById('app-container').classList.contains('d-none')) {
//         return; // Don't show prompt on auth screen
//     }
//     e.preventDefault();
//     e.returnValue = '';
// });