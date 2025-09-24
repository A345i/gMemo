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
        const saveIndicator = document.getElementById('save-indicator');
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
            showAll: document.getElementById('show-all-button'),
            grid: document.getElementById('grid-button')
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


        // --- App State ---
        let pages = [null];
        let currentPageIndex = 0;
        let currentTool = null;
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
        const gridSpacing = 50; // Расстояние между линиями сетки в пиксел��х
        const gridColor = '#e0e0e0';
        let realtimeChannel = null; // Для хранения подписки Realtime
        let sessionId = null; // --- NEW: Unique ID for this tab/session ---

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
                            uuid: crypto.randomUUID()
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
                            uuid: crypto.randomUUID()
                        });
                    }
                    fabricCanvas.add(textObject);
                    fabricCanvas.setActiveObject(textObject);
                    fabricCanvas.renderAll();
                    saveState();
                }
                voiceModal.hide();
                voiceInputPosition = null;
            });
        }


        // --- Mobile Toolbar Logic ---
        mobileShapesToggle.addEventListener('click', () => {
            const willBeActive = !mobileShapesOptions.classList.contains('active');

            // Hide draw options if we are opening shapes
            if (willBeActive && mobileDrawOptions.classList.contains('active')) {
                mobileDrawOptions.classList.remove('active');
                document.body.classList.remove('draw-tool-active');
            }

            mobileShapesOptions.classList.toggle('active', willBeActive);
            document.body.classList.toggle('shapes-options-active', willBeActive);

            // If we are closing the panel and a shape tool is active, deactivate the tool
            if (!willBeActive && ['line', 'arrow', 'rect', 'circle'].includes(currentTool)) {
                setActiveTool(null);
            }

            setTimeout(resizeCanvas, 210);
        });

        // --- Desktop Shapes Dropdown Logic ---
        const shapesDropdown = document.getElementById('shapes-dropdown');
        if (shapesDropdown) {
            // Add event listeners to all shape buttons in the dropdown
            const shapeButtons = document.querySelectorAll('.dropdown-item[data-tool]');
            shapeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tool = button.dataset.tool;
                    if (tool) {
                        // Toggle logic: if same tool is clicked, deactivate. Otherwise, activate new tool.
                        if (tool === currentTool) {
                            setActiveTool(null);
                        } else {
                            setActiveTool(tool);
                        }
                    }
                });
            });
        }

        mobileActionsToggle.addEventListener('click', () => {
            const willBeActive = !mobileActionsOptions.classList.contains('active');

            // Hide other panels if we are opening actions
            if (willBeActive) {
                if (mobileDrawOptions.classList.contains('active')) {
                    mobileDrawOptions.classList.remove('active');
                    document.body.classList.remove('draw-tool-active');
                }
                if (mobileShapesOptions.classList.contains('active')) {
                    mobileShapesOptions.classList.remove('active');
                    document.body.classList.remove('shapes-options-active');
                }
            }

            mobileActionsOptions.classList.toggle('active', willBeActive);
            document.body.classList.toggle('actions-options-active', willBeActive);
            mobileActionsToggle.classList.toggle('active', willBeActive);

            setTimeout(resizeCanvas, 210);
        });
        
        // --- UI State Functions ---
        const showLoader = () => loadingOverlay.classList.remove('d-none');
        const hideLoader = () => loadingOverlay.classList.add('d-none');
        
        // --- Fabric.js Canvas Initialization ---
        const fabricCanvas = new fabric.Canvas(canvasElement, { isDrawingMode: false, backgroundColor: '#fff', selection: false });
        
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
            await saveNotesToSupabase(); 
            if (realtimeChannel) {
                supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            await supabaseClient.auth.signOut(); 
        });

        // --- Supabase Data Functions ---
        const setupRealtimeSubscription = () => {
            // Clean up any existing channel before creating a new one
            if (realtimeChannel) {
                supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }

            if (!currentUser) return;

            realtimeChannel = supabaseClient.channel(`profiles:id=eq.${currentUser.id}`)
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'profiles', 
                    filter: `id=eq.${currentUser.id}` 
                }, 
                (payload) => {
            // --- NEW: Robust sync logic to prevent echo ---
            try {
                // Attempt to parse the incoming data to check who made the change.
                if (payload.new && payload.new.profile_text) {
                    const updatedData = JSON.parse(payload.new.profile_text);
                    // If the change was made by this browser session, ignore it.
                    if (updatedData.lastUpdatedBy === sessionId) {
                        console.log('Ignoring own update (echo).');
                        return;
                    }
                }
            } catch (e) {
                // If parsing fails, log the error but still reload to be safe.
                console.error('Error parsing realtime payload, reloading as a fallback:', e);
                loadNotesFromSupabase();
                return;
            }

            // If the change is from another session, load the new data.
            console.log('Change detected from another session. Loading new data.');
            loadNotesFromSupabase();
        })
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Successfully subscribed to Realtime channel!');
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Realtime subscription error:', err);
                    }
                });
        };

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
            }
            else {
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
                currentPageIndex: currentPageIndex,
                lastUpdatedBy: sessionId // --- NEW: Tag the save with our session ID ---
            };
            const notesJson = JSON.stringify(saveData);
            const { error } = await supabaseClient.from('profiles').update({ profile_text: notesJson }).eq('id', currentUser.id);
            if (error) {
                console.error('Error saving to Supabase:', error);
            } else {
                saveIndicator.classList.remove('unsaved');
                saveIndicator.classList.add('saved');
                setTimeout(() => {
                    saveIndicator.classList.remove('saved');
                }, 1500);
            }
        };
        
        const debouncedSave = _.debounce(saveNotesToSupabase, 2000);

        // --- NEW, ROBUST AUTH HANDLING ---
        const setupAuthenticatedApp = async (session) => {
            if (currentUser && dataLoaded) { return; } // Prevent re-initialization on token refresh
            currentUser = session.user;
            await loadNotesFromSupabase();
            userEmailDisplay.textContent = currentUser.email;
            authContainer.classList.add('d-none');
            appContainer.classList.remove('d-none');
            resizeCanvas();
            setActiveTool(null); // Ensure no tool is active on load
            setupRealtimeSubscription(); // --- NEW: Start listening for changes ---
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

        const initializeApp = async () => {
            sessionId = crypto.randomUUID(); // --- NEW: Assign a unique ID for this session ---
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
            saveIndicator.classList.remove('saved');
            saveIndicator.classList.add('unsaved');
            redoStack = []; 
            const state = fabricCanvas.toJSON(['isLink', 'url', 'uuid']); // --- MODIFIED: Include uuid
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
                            
                            // Assign new UUIDs to all objects being pasted
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
                            saveState();
                        }
                    }, 'fabric');
                }
                // Deactivate paste mode after pasting once
                setActiveTool('select');
                return;
            }

            if (opt.e.altKey) {
                isPanning = true;
                fabricCanvas.selection = false;
                lastPosX = opt.e.clientX;
                lastPosY = opt.e.clientY;
                fabricCanvas.setCursor('grabbing');
            } else if (!isTouching && (currentTool === 'text' || currentTool === 'voice') && !opt.target) {
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
            } else if (isCreatingText && textCreationInfo) {
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
                fabricCanvas.selection = true;
                fabricCanvas.setCursor('default');
                saveState(); // Save state after panning
            } else if (isCreatingText) {
                // If we were drawing a selection box, remove it
                if (shapeInProgress) {
                    fabricCanvas.remove(shapeInProgress);
                }

                const wasDrag = shapeInProgress && shapeInProgress.width > 5 && shapeInProgress.height > 5;
                const creationType = textCreationInfo.type;

                if (creationType === 'text') {
                    let textObject;
                    if (wasDrag) {
                        // Dragged - create a Textbox
                        textObject = new fabric.Textbox('Текст', {
                            left: shapeInProgress.left,
                            top: shapeInProgress.top,
                            width: shapeInProgress.width,
                            height: shapeInProgress.height,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            uuid: crypto.randomUUID()
                        });
                    } else {
                        // Clicked - create an IText
                        textObject = new fabric.IText('Текст', {
                            left: textCreationInfo.startX,
                            top: textCreationInfo.startY,
                            fill: colorPickers[0].value,
                            fontSize: 24,
                            fontFamily: 'Arial',
                            originX: 'center',
                            originY: 'center',
                            uuid: crypto.randomUUID()
                        });
                    }
                    fabricCanvas.add(textObject);
                    fabricCanvas.setActiveObject(textObject);
                    textObject.enterEditing();
                    textObject.selectAll();
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
                fabricCanvas.selection = (currentTool === 'select'); // Restore selection only if select tool is active
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
            currentTool = tool;
            const isDrawTool = tool === 'draw' || tool === 'marker';
            const isShapeTool = ['line', 'arrow', 'rect', 'circle'].includes(tool);

            // Drawing mode is only for pencil and marker
            fabricCanvas.isDrawingMode = isDrawTool;

            // Configure canvas based on tool
            const isSelectMode = tool === 'select';
            fabricCanvas.selection = isSelectMode;

            // When not in select mode, ensure nothing is selected
            if (!isSelectMode) {
                fabricCanvas.discardActiveObject();
            }

            // Set object interactivity based on the current tool
            fabricCanvas.forEachObject(obj => {
                const isSelectable = (tool === 'select');
                // An object can fire events if we are in select mode, OR
                // if we are in neutral mode and the object is a link.
                const isEvented = isSelectable || (tool === null && obj.isLink);
                obj.set({ 
                    selectable: isSelectable,
                    evented: isEvented 
                });
            });

            if (tool === 'eyedropper') {
                fabricCanvas.defaultCursor = 'crosshair';
                fabricCanvas.hoverCursor = 'crosshair';
            } else if (tool === 'paste') {
                fabricCanvas.defaultCursor = 'crosshair';
                fabricCanvas.hoverCursor = 'crosshair';
            } else {
                fabricCanvas.defaultCursor = 'default';
                fabricCanvas.hoverCursor = 'default';
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
            // Draw options panel
            if (isDrawTool) {
                mobileDrawOptions.classList.add('active');
                document.body.classList.add('draw-tool-active');
            } else {
                mobileDrawOptions.classList.remove('active');
                document.body.classList.remove('draw-tool-active');
            }

            // Shapes options panel - hide if a draw tool is selected, or if a non-shape tool is selected
            if (isDrawTool || !isShapeTool) {
                mobileShapesOptions.classList.remove('active');
                document.body.classList.remove('shapes-options-active');
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

            // Prevent division by zero or Infinity scale for tiny/zero-dimension objects
            if (aabb.width < 1 || aabb.height < 1) {
                const newVpt = [1, 0, 0, 1, 0, 0]; // Reset zoom to 1
                // Center view on the small object
                newVpt[4] = (canvasWidth / 2) - (aabb.left + aabb.width / 2);
                newVpt[5] = (canvasHeight / 2) - (aabb.top + aabb.height / 2);
                fabricCanvas.setViewportTransform(newVpt);
                fabricCanvas.renderAll();
                saveState();
                return;
            }

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

        const groupButton = document.getElementById('group-button');
        const ungroupButton = document.getElementById('ungroup-button');
        const mobileGroupButton = document.getElementById('mobile-group-button');
        const mobileUngroupButton = document.getElementById('mobile-ungroup-button');

        // Function to handle group functionality
        const handleGroup = () => {
            const activeSelection = fabricCanvas.getActiveObject();
            if (activeSelection && activeSelection.type === 'activeSelection') {
                const group = activeSelection.toGroup();
                group.uuid = crypto.randomUUID(); // Assign UUID to the new group
                fabricCanvas.renderAll();
                saveState(); // Save state after grouping
            }
        };

        // Function to handle ungroup functionality
        const handleUngroup = () => {
            const activeGroup = fabricCanvas.getActiveObject();
            if (activeGroup && activeGroup.type === 'group') {
                activeGroup.toActiveSelection();
                fabricCanvas.renderAll();
                saveState(); // Save state after ungrouping
            }
        };

        toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool) {
                    if (tool === 'delete') {
                        fabricCanvas.getActiveObjects().forEach(obj => fabricCanvas.remove(obj));
                        fabricCanvas.discardActiveObject().renderAll();
                        saveState(); // Save state after deletion
                    } else if (tool === 'group') {
                        handleGroup();
                    } else if (tool === 'ungroup') {
                        handleUngroup();
                    } else if (tool === 'copy') {
                        const activeObject = fabricCanvas.getActiveObject();
                        if (activeObject) {
                            activeObject.clone(function(cloned) {
                                const serialized = cloned.toJSON(['isLink', 'url', 'uuid']);
                                localStorage.setItem('gmemoClipboard', JSON.stringify(serialized));
                                // Optional: provide user feedback
                                alert('Скопировано в буфер обмена!');
                            });
                        }
                    } else if (tool === 'paste') {
                        if (localStorage.getItem('gmemoClipboard')) {
                            setActiveTool('paste');
                        } else {
                            alert('Буфер обмена пуст.');
                        }
                    } else if (tool === 'link') {
                        const url = prompt("Введите URL ссылки:", "https://");
                        if (!url) return;
                        const text = prompt("Введите текст для ссылки:", "Моя ссылка");
                        if (!text) return;
                        const linkText = new fabric.IText(text, { left: 150, top: 150, fontSize: 24, fill: '#007bff', underline: true, fontFamily: 'Arial', isLink: true, url: url, uuid: crypto.randomUUID() });
                        fabricCanvas.add(linkText);
                        saveState(); // Save state after adding link
                    } else {
                        // Toggle logic: if same tool is clicked, deactivate. Otherwise, activate new tool.
                        if (tool === currentTool) {
                            setActiveTool(null);
                        } else {
                            setActiveTool(tool);
                        }
                    }
                }
            });
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

        // Add event listeners for shape buttons in the dropdown
        const shapeButtons = document.querySelectorAll('.dropdown-item[data-tool]');
        shapeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tool = button.dataset.tool;
                if (tool) {
                    // Close the dropdown after selecting a tool
                    const dropdown = bootstrap.Dropdown.getInstance(button.closest('.dropdown'));
                    if (dropdown) {
                        dropdown.hide();
                    }
                    
                    // Toggle logic: if same tool is clicked, deactivate. Otherwise, activate new tool.
                    if (tool === currentTool) {
                        setActiveTool(null);
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

        imageUploadInputs.forEach(input => { input.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (f) => { fabric.Image.fromURL(f.target.result, (img) => { img.scaleToWidth(200); img.uuid = crypto.randomUUID(); fabricCanvas.add(img); }); }; reader.readAsDataURL(file); e.target.value = ''; }); });
        window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && !fabricCanvas.getActiveObject()?.isEditing) { document.querySelector('[data-tool="delete"]').click(); } });
        
        fabricCanvas.on({ 'object:added': saveState, 'object:removed': saveState, 'object:modified': saveState });

        // --- NEW: Assign UUID to newly created paths from free drawing ---
        fabricCanvas.on('path:created', function(e) {
            if (e.path) {
                e.path.uuid = crypto.randomUUID();
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

        fabricCanvas.on({
            'selection:created': updateGroupButtons,
            'selection:updated': updateGroupButtons,
            'selection:cleared': updateGroupButtons
        });

        fabricCanvas.on('mouse:dblclick', (options) => { if (options.target) { if (options.target.isLink) { const target = options.target; const newText = prompt("Измените текст ссылки:", target.text); if (newText !== null) target.set('text', newText); const newUrl = prompt("Измените URL:", target.url); if (newUrl !== null) target.set('url', newUrl); fabricCanvas.renderAll(); } else if (options.target.type === 'i-text') { const target = options.target; target.enterEditing(); const selectionStart = target.getSelectionStartFromPointer(options.e); const start = target.findWordBoundaryLeft(selectionStart); const end = target.findWordBoundaryRight(selectionStart); target.setSelectionStart(start); target.setSelectionEnd(end); fabricCanvas.renderAll(); } } });

        // --- Page Navigation with IMMEDIATE save ---
        pageControls.prev.addEventListener('click', async () => {
            if (currentPageIndex > 0) {
                showLoader();
                saveCurrentPage(); // Save canvas of the page we are leaving
                const newPageIndex = currentPageIndex - 1;
                loadPage(newPageIndex); // Update local state and currentPageIndex
                await saveNotesToSupabase(); // Save the new state with the correct index
                hideLoader();
            }
        });
        pageControls.next.addEventListener('click', async () => {
            if (currentPageIndex < pages.length - 1) {
                showLoader();
                saveCurrentPage(); // Save canvas of the page we are leaving
                const newPageIndex = currentPageIndex + 1;
                loadPage(newPageIndex); // Update local state and currentPageIndex
                await saveNotesToSupabase(); // Save the new state with the correct index
                hideLoader();
            }
        });
        pageControls.add.addEventListener('click', async () => {
            showLoader();
            saveCurrentPage(); // Save canvas of the page we are leaving
            pages.push(null);
            const newPageIndex = pages.length - 1;
            loadPage(newPageIndex); // Update local state and currentPageIndex
            await saveNotesToSupabase(); // Save the new state with the correct index
            hideLoader();
        });
        pageControls.delete.addEventListener('click', async () => {
            if (pages.length <= 1) {
                alert("Нельзя удалить последнюю страницу.");
                return;
            }
            if (confirm("Вы уверены, что хотите удалить эту страницу?")) {
                showLoader();
                // No need to save the current page as it's being deleted
                pages.splice(currentPageIndex, 1);
                let newPageIndex = currentPageIndex;
                if (newPageIndex >= pages.length) {
                    newPageIndex = pages.length - 1;
                }
                loadPage(newPageIndex); // Update local state and currentPageIndex
                await saveNotesToSupabase(); // Save the new state with the correct index
                hideLoader();
            }
        });
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