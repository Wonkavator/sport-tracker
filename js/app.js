// DOM Elements
const views = {
    dashboard: document.getElementById('view-dashboard'),
    train: document.getElementById('view-train'),
    input: document.getElementById('view-input'),
    success: document.getElementById('view-success'),
    progress: document.getElementById('view-progress'),
    analysis: document.getElementById('view-analysis'),
    settings: document.getElementById('view-settings')
};

const navBtns = {
    dashboard: document.getElementById('nav-dashboard'),
    train: document.getElementById('nav-train'),
    progress: document.getElementById('nav-progress'),
    analysis: document.getElementById('nav-analysis'),
    settings: document.getElementById('nav-settings')
};

// State
let currentExercise = null;
let selectedDateForEntry = null;
let entryToDelete = null;
let editingEntryId = null;
let editingCustomExerciseId = null; // New state for editing custom exercises

// Initialize App
function init() {
    console.log('App initialized');

    // Run custom exercises check and logic
    initCustomExercisesStorage();

    // Perform migration and load data into app memory
    loadCustomExercises();

    // Auto-scrub orphaned entries (hotfix for previous deletion bug)
    let entries = getAllEntries();
    let validIds = appData.exercises.map(e => e.id);
    let originalLength = entries.length;
    entries = entries.filter(e => validIds.includes(e.exerciseId));
    if (entries.length < originalLength) {
        localStorage.setItem('training_tracker_data', JSON.stringify(entries));
        console.log(`Scrubbed ${originalLength - entries.length} orphaned entries.`);
    }

    appData.entries = entries;

    // Attach event listeners for main navigation
    document.querySelectorAll('.app-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.app-nav-btn').dataset.target;
            showView(target);
        });
    });

    // Sub-navigation in training view
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', handleTabClick);
    });

    setupTheme();
    setupNavigation();
    setupSettingsView(); // Init drag and drop and settings logic
    renderExerciseList();
    renderDashboard();
    renderProgress();
    renderAnalysis();

    // Setup Form Submission
    document.getElementById('exercise-form').addEventListener('submit', handleFormSubmit);

    // Setup Week Navigation
    document.getElementById('btn-prev-week').addEventListener('click', () => {
        changeWeekOffset(-1);
        renderDashboard();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
        changeWeekOffset(1);
        renderDashboard();
    });

    // Setup Back button
    document.getElementById('btn-back-to-categories').addEventListener('click', () => {
        showView('train');
    });

    // Setup Success OK button
    document.getElementById('btn-success-ok').addEventListener('click', () => {
        renderDashboard();
        showView('dashboard');
    });

    // Close Chart Button
    document.getElementById('btn-close-chart').addEventListener('click', () => {
        document.getElementById('analysis-chart-container').style.display = 'none';
        document.getElementById('analysis-list-container').style.display = 'block';
    });

    // Setup Custom Delete Modal
    document.getElementById('btn-cancel-delete').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('active');
        entryToDelete = null;
    });

    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
        if (entryToDelete) {
            deleteEntry(entryToDelete);
            entryToDelete = null;
            document.getElementById('delete-modal').classList.remove('active');
            renderDashboard();
            renderProgress();
            showView('dashboard'); // Return to dashboard, exiting the edit form
        }
    });

    // Handle Data Export
    document.getElementById('btn-export-data').addEventListener('click', () => {
        const backupData = {
            entries: localStorage.getItem('training_tracker_data'),
            customExercises: localStorage.getItem('training_tracker_custom_exercises'),
            theme: localStorage.getItem('theme'),
            exportDate: new Date().toISOString()
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `training_tracker_backup_${formatDateToLocalString(new Date())}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Handle Data Import Trigger
    const fileInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-data').addEventListener('click', () => {
        if (confirm("Warnung: Ein Import überschreibt alle deine aktuellen Daten auf diesem Gerät! Möchtest du fortfahren?")) {
            fileInput.click();
        }
    });

    // Handle Data Import Read
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const importedData = JSON.parse(event.target.result);

                // Validate payload
                if (importedData.entries !== undefined && importedData.customExercises !== undefined) {
                    localStorage.setItem('training_tracker_data', importedData.entries);
                    localStorage.setItem('training_tracker_custom_exercises', importedData.customExercises);
                    if (importedData.theme) localStorage.setItem('theme', importedData.theme);

                    alert("Daten erfolgreich importiert! Die App wird nun neu geladen.");
                    window.location.reload();
                } else {
                    alert("Import fehlgeschlagen: Die Datei hat nicht das erwartete Format.");
                }
            } catch (err) {
                console.error("Import error:", err);
                alert("Import fehlgeschlagen: Datei konnte nicht gelesen werden.");
            }
            // Reset file input so the same file can be selected again if needed
            fileInput.value = "";
        };
        reader.readAsText(file);
    });
}

// Theme Logic
function setupTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeBtn.textContent = '🌙';
    }

    themeBtn.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeBtn.textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeBtn.textContent = '☀️';
        }

        // Re-render chart text colors if it exists
        if (currentChart) {
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();
            if (currentChart.options.scales.x) currentChart.options.scales.x.ticks.color = textColor;
            if (currentChart.options.scales.y) currentChart.options.scales.y.ticks.color = textColor;
            currentChart.update();
        }
    });
}

// Navigation Logic
function setupNavigation() {
    Object.keys(navBtns).forEach(key => {
        if (navBtns[key]) {
            navBtns[key].addEventListener('click', () => {
                // If navigating manually to train view, reset the custom date
                if (key === 'train') selectedDateForEntry = null;
                showView(key);
            });
        }
    });
}

function showView(viewId) {
    console.log(`showView called with: ${viewId}`);
    try {
        // Re-render views just in case data was updated
        if (viewId === 'dashboard') renderDashboard();
        if (viewId === 'progress') renderProgress();
        if (viewId === 'analysis') {
            renderAnalysis();
            // Hide chart and show list on tab enter
            document.getElementById('analysis-chart-container').style.display = 'none';
            document.getElementById('analysis-list-container').style.display = 'block';
        }
        if (viewId === 'settings') {
            resetCustomExerciseForm(); // Ensure form is empty on load
            renderCustomExercisesList();
        }

        console.log('Hiding all active views...');
        // Hide all views
        Object.values(views).forEach(view => {
            if (view) view.classList.remove('active');
        });

        console.log('Showing selected view...');
        // Show selected view
        if (views[viewId]) views[viewId].classList.add('active');

        console.log('Updating Nav Activity...');
        // Update Nav Activity
        Object.values(navBtns).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (navBtns[viewId]) navBtns[viewId].classList.add('active');
        console.log(`showView completed for: ${viewId}`);
    } catch (error) {
        console.error('ERROR IN showView:', error);
    }
}

// Render the flat list of exercises
function renderExerciseList() {
    const listContainer = document.getElementById('category-list');
    listContainer.innerHTML = '';

    appData.exercises.forEach(ex => {
        if (ex.archived) return; // Skip archived exercises

        const btn = document.createElement('div');
        btn.className = `category-card ${ex.catId}`;
        btn.textContent = ex.name;

        btn.addEventListener('click', () => openInputForm(ex));
        listContainer.appendChild(btn);
    });
}

// Open Form for an exercise (for both Add and Edit)
function openInputForm(exercise, existingEntry = null) {
    currentExercise = exercise;
    editingEntryId = existingEntry ? existingEntry.id : null;

    const titleEl = document.getElementById('input-exercise-title');
    titleEl.textContent = existingEntry ? `Bearbeiten: ${exercise.name}` : exercise.name;
    titleEl.className = exercise.catId;

    const container = document.getElementById('dynamic-inputs');
    container.innerHTML = ''; // clear form

    // Build inputs based on exercise configuration
    exercise.inputs.forEach(inputId => {
        const def = appData.inputDefinitions[inputId];
        if (!def) return;

        const group = document.createElement('div');
        group.className = 'input-group';

        const label = document.createElement('label');
        label.setAttribute('for', `input-${inputId}`);
        label.textContent = def.label;

        const input = document.createElement('input');
        input.type = def.type;
        input.id = `input-${inputId}`;
        input.name = inputId;
        input.required = def.type !== 'text'; // only text is optional here
        if (def.step) input.step = def.step;
        if (def.type === 'number') input.min = 0;

        // Pre-fill if editing
        if (existingEntry && existingEntry.inputs[inputId]) {
            input.value = existingEntry.inputs[inputId];
        }

        group.appendChild(label);
        group.appendChild(input);
        container.appendChild(group);
    });

    // Manage Delete Button visibility within the form
    let deleteBtn = document.getElementById('btn-delete-entry-in-form');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'btn-delete-entry-in-form';
        deleteBtn.type = 'button';
        deleteBtn.className = 'nav-btn';
        deleteBtn.style.width = '100%';
        deleteBtn.style.marginTop = '1rem';
        deleteBtn.style.backgroundColor = 'var(--cat-red)';
        deleteBtn.style.color = 'white';
        deleteBtn.textContent = 'Eintrag löschen';
        document.getElementById('exercise-form').appendChild(deleteBtn);

        deleteBtn.addEventListener('click', () => {
            if (editingEntryId) {
                entryToDelete = editingEntryId;
                document.getElementById('delete-modal-text').textContent = `Möchtest du das Training "${currentExercise.name}" wirklich löschen?`;
                document.getElementById('delete-modal').classList.add('active');
            }
        });
    }

    if (existingEntry) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }

    showView('input');
}

// Handle Form Submission
function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentExercise) return;

    const formData = new FormData(e.target);
    const inputs = {};

    currentExercise.inputs.forEach(inputId => {
        inputs[inputId] = formData.get(inputId);
    });

    if (editingEntryId) {
        // Update existing entry
        updateEntry(editingEntryId, {
            exerciseId: currentExercise.id,
            catId: currentExercise.catId,
            inputs: inputs
        });
        editingEntryId = null;
    } else {
        // Save new entry
        saveEntry({
            exerciseId: currentExercise.id,
            catId: currentExercise.catId,
            inputs: inputs
        }, selectedDateForEntry);
    }

    // Reset date after saving
    selectedDateForEntry = null;

    // Show success view
    showView('success');
    e.target.reset();
}

// Render Dashboard Grid
function renderDashboard() {
    const container = document.getElementById('weekly-grid-container');
    container.innerHTML = '';

    // Update Week Title
    const weekTitle = document.getElementById('week-title');
    const offset = getWeekOffset();
    if (offset === 0) {
        weekTitle.textContent = 'Aktuelle Woche';
    } else if (offset === -1) {
        weekTitle.textContent = 'Letzte Woche';
    } else {
        weekTitle.textContent = `Woche ${offset > 0 ? '+' : ''}${offset}`;
    }

    const weekData = getEntriesForCurrentWeek();

    const grid = document.createElement('div');
    grid.className = 'week-grid';

    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    weekData.forEach((dayData, index) => {
        const col = document.createElement('div');
        col.className = 'day-column';

        const header = document.createElement('div');
        header.className = 'day-header';

        // Highlight today
        const isToday = formatDateToLocalString(new Date()) === dayData.date;
        if (isToday) header.style.color = 'var(--text-color)';

        header.textContent = dayNames[index];
        col.appendChild(header);

        // Add date label
        const dateLabel = document.createElement('div');
        dateLabel.className = 'day-header-date';
        const dStr = `${String(dayData.dayObj.getDate()).padStart(2, '0')}.${String(dayData.dayObj.getMonth() + 1).padStart(2, '0')}.`;
        dateLabel.textContent = dStr;
        col.appendChild(dateLabel);

        // Add color blocks for entries
        dayData.entries.forEach(entry => {
            const block = document.createElement('div');
            block.className = `entry-block ${entry.catId}`;
            const exName = getExerciseById(entry.exerciseId)?.name || 'Eintrag';
            block.title = `${exName} (Zum Bearbeiten klicken)`;

            // Add name label to block
            const nameSpan = document.createElement('span');
            nameSpan.className = 'entry-name';
            // Simplify long names for mobile view
            let displayName = exName.replace(' - MOTOmed', '');
            if (displayName.includes('Rollstuhl:')) displayName = displayName.replace('Rollstuhl: ', '');

            nameSpan.textContent = displayName;
            block.appendChild(nameSpan);

            // Edit handler instead of direct delete
            block.addEventListener('click', () => {
                const ex = getExerciseById(entry.exerciseId);
                if (ex) {
                    openInputForm(ex, entry);
                }
            });

            col.appendChild(block);
        });

        // Add '+' button at the bottom
        const addBtn = document.createElement('button');
        addBtn.className = 'add-entry-btn';
        addBtn.innerHTML = '&#43;'; // Plus sign
        addBtn.title = 'Eintrag für diesen Tag hinzufügen';
        addBtn.addEventListener('click', () => {
            selectedDateForEntry = dayData.date;
            showView('train');
        });
        col.appendChild(addBtn);

        grid.appendChild(col);
    });

    container.appendChild(grid);
}

// Render Long-Term Progress
function renderProgress() {
    const container = document.getElementById('progress-container');
    container.innerHTML = '';

    const allEntries = getAllEntries();
    if (allEntries.length === 0) {
        container.innerHTML = '<p>Noch keine Daten vorhanden. Starte heute mit deinem Training!</p>';
        return;
    }

    let totalMins = 0;
    let totalKm = 0;

    allEntries.forEach(entry => {
        if (entry.inputs.duration) totalMins += parseInt(entry.inputs.duration, 10);
        if (entry.inputs.distance) totalKm += parseFloat(entry.inputs.distance);
    });

    const totalHours = Math.floor(totalMins / 60);
    const remainingMins = totalMins % 60;

    const statsHtml = `
        <div class="progress-card cat-yellow" style="padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem;">
            <h3>🚴 MOTOmed Distanz</h3>
            <p style="font-size: 2rem; font-weight: bold;">${totalKm.toFixed(1)} km</p>
        </div>
        <div class="progress-card cat-blue" style="padding: 1.5rem; border-radius: 12px; color: white;">
            <h3>⏱️ Gesamttrainingszeit</h3>
            <p style="font-size: 2rem; font-weight: bold;">${totalHours} Std ${remainingMins} Min</p>
        </div>
    `;

    container.innerHTML = statsHtml;
}

// Render Analysis Data
let currentChart = null;

function renderAnalysis() {
    const listContainer = document.getElementById('analysis-list-container');
    listContainer.innerHTML = '';

    const allEntries = getAllEntries();

    if (allEntries.length === 0) {
        listContainer.innerHTML = '<p>Noch keine Daten für Auswertungen vorhanden.</p>';
        return;
    }

    // Group totals by exercise
    const exerciseStats = {};

    allEntries.forEach(entry => {
        if (!exerciseStats[entry.exerciseId]) {
            exerciseStats[entry.exerciseId] = {
                id: entry.exerciseId,
                name: getExerciseById(entry.exerciseId)?.name || 'Unbekannt',
                catId: entry.catId,
                totals: {
                    duration: 0,
                    distance: 0,
                    reps: 0,
                    repsLeft: 0,
                    repsRight: 0,
                    rounds: 0,
                    maxDurationSec: 0
                },
                entries: []
            };
        }

        const stats = exerciseStats[entry.exerciseId];
        stats.entries.push(entry);

        // Sum values
        if (entry.inputs.duration) stats.totals.duration += parseInt(entry.inputs.duration, 10);
        if (entry.inputs.distance) stats.totals.distance += parseFloat(entry.inputs.distance);
        if (entry.inputs.reps) stats.totals.reps += parseInt(entry.inputs.reps, 10);
        if (entry.inputs.repsLeft) stats.totals.repsLeft += parseInt(entry.inputs.repsLeft, 10);
        if (entry.inputs.repsRight) stats.totals.repsRight += parseInt(entry.inputs.repsRight, 10);
        if (entry.inputs.rounds) stats.totals.rounds += parseInt(entry.inputs.rounds, 10);
        if (entry.inputs.maxDurationSec) stats.totals.maxDurationSec += parseInt(entry.inputs.maxDurationSec, 10);
    });

    // Render list
    Object.values(exerciseStats).forEach(stat => {
        const item = document.createElement('div');
        item.className = `analysis-item ${stat.catId}`;

        const leftSide = document.createElement('div');
        const titleLabel = document.createElement('div');
        titleLabel.className = 'analysis-item-title';
        titleLabel.textContent = stat.name;

        const countLabel = document.createElement('div');
        countLabel.style.fontSize = '0.8rem';
        countLabel.style.color = '#666';
        countLabel.textContent = `${stat.entries.length} Einträge`;

        leftSide.appendChild(titleLabel);
        leftSide.appendChild(countLabel);

        const rightSide = document.createElement('div');
        rightSide.className = 'analysis-item-stats';

        let statText = [];
        if (stat.totals.duration > 0) statText.push(`${stat.totals.duration} Min`);
        if (stat.totals.distance > 0) statText.push(`${stat.totals.distance.toFixed(1)} km`);
        if (stat.totals.reps > 0) statText.push(`${stat.totals.reps} Wdh.`);
        if (stat.totals.rounds > 0) statText.push(`${stat.totals.rounds} Runden`);
        if (stat.totals.repsLeft > 0 || stat.totals.repsRight > 0) statText.push(`${stat.totals.repsLeft}/${stat.totals.repsRight} R`);
        if (stat.totals.maxDurationSec > 0) statText.push(`${stat.totals.maxDurationSec} Sek Ges.`);

        rightSide.textContent = statText.join(' | ');

        item.appendChild(leftSide);
        item.appendChild(rightSide);

        item.addEventListener('click', () => {
            showChartForExercise(stat);
        });

        listContainer.appendChild(item);
    });
}

let currentChartStatInfo = null;

function showChartForExercise(statInfo, filter = 'day-7') {
    currentChartStatInfo = statInfo;
    document.getElementById('analysis-list-container').style.display = 'none';
    const chartContainer = document.getElementById('analysis-chart-container');
    chartContainer.style.display = 'block';

    document.getElementById('chart-title').textContent = statInfo.name;

    // Filter UI setup
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');

        // Remove old listeners to avoid duplicates, then add new
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            showChartForExercise(currentChartStatInfo, newBtn.dataset.filter);
        });
    });

    // Helper functions for grouping dates
    const getLabelForDay = (dateObj) => `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

    // ISO Week number logic
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return { year: d.getUTCFullYear(), week: weekNo };
    };

    const getLabelForWeek = (dateObj) => {
        const wk = getWeekNumber(dateObj);
        return `KW ${wk.week} "${wk.year.toString().slice(-2)}`;
    };

    const getLabelForMonth = (dateObj) => {
        const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
        return `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    };

    // Sort entries by timestamp
    const sortedEntries = [...statInfo.entries].sort((a, b) => a.timestamp - b.timestamp);

    // Filter entries by date range if applicable
    let cutoffDate = null;
    const groupedData = {};

    if (filter === 'day-7') {
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 6);
        cutoffDate.setHours(0, 0, 0, 0);
    } else if (filter === 'day-30') {
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 29);
        cutoffDate.setHours(0, 0, 0, 0);
    }

    if (filter.startsWith('day')) {
        const days = filter === 'day-7' ? 7 : 30;
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
            groupedData[groupKey] = {
                distance: 0, duration: 0, reps: 0, rounds: 0, repsLeft: 0, repsRight: 0, maxDurationSec: 0,
                dateObj: new Date(d),
                entries: []
            };
        }
    }

    let entriesToProcess = sortedEntries;
    if (cutoffDate) {
        entriesToProcess = sortedEntries.filter(e => new Date(e.timestamp) >= cutoffDate);
    }

    entriesToProcess.forEach(e => {
        const d = new Date(e.timestamp);
        let groupKey = '';
        if (filter.startsWith('day')) {
            groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        } else if (filter === 'week') {
            const wk = getWeekNumber(d);
            groupKey = `${wk.year}-W${wk.week.toString().padStart(2, '0')}`;
        } else if (filter === 'month') {
            groupKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        if (!groupedData[groupKey]) {
            groupedData[groupKey] = {
                distance: 0, duration: 0, reps: 0, rounds: 0, repsLeft: 0, repsRight: 0, maxDurationSec: 0,
                dateObj: d,
                entries: []
            };
        }

        if (filter.startsWith('day')) {
            groupedData[groupKey].entries.push(e);
        } else {
            groupedData[groupKey].distance += parseFloat(e.inputs.distance || 0);
            groupedData[groupKey].duration += parseFloat(e.inputs.duration || 0);
            groupedData[groupKey].reps += parseInt(e.inputs.reps || 0);
            groupedData[groupKey].rounds += parseInt(e.inputs.rounds || 0);
            groupedData[groupKey].repsLeft += parseInt(e.inputs.repsLeft || 0);
            groupedData[groupKey].repsRight += parseInt(e.inputs.repsRight || 0);

            const mDur = parseInt(e.inputs.maxDurationSec || 0);
            if (mDur > groupedData[groupKey].maxDurationSec) {
                groupedData[groupKey].maxDurationSec = mDur;
            }
        }
    });

    const groupKeys = Object.keys(groupedData).sort();

    const labels = [];
    const distanceData = [];
    const durationData = [];
    const repsData = [];
    const roundsData = [];
    const repsLeftData = [];
    const repsRightData = [];
    const maxDurationSecData = [];

    groupKeys.forEach(key => {
        const group = groupedData[key];
        const dObj = group.dateObj;

        if (filter.startsWith('day')) {
            const dayLabel = getLabelForDay(dObj);
            if (group.entries && group.entries.length > 0) {
                group.entries.forEach(e => {
                    labels.push(dayLabel);
                    distanceData.push(parseFloat(e.inputs.distance || 0));
                    durationData.push(parseFloat(e.inputs.duration || 0));
                    repsData.push(parseInt(e.inputs.reps || 0));
                    roundsData.push(parseInt(e.inputs.rounds || 0));
                    repsLeftData.push(parseInt(e.inputs.repsLeft || 0));
                    repsRightData.push(parseInt(e.inputs.repsRight || 0));
                    maxDurationSecData.push(parseInt(e.inputs.maxDurationSec || 0));
                });
            } else {
                labels.push(dayLabel);
                distanceData.push(0);
                durationData.push(0);
                repsData.push(0);
                roundsData.push(0);
                repsLeftData.push(0);
                repsRightData.push(0);
                maxDurationSecData.push(0);
            }
        } else {
            labels.push(filter === 'week' ? getLabelForWeek(dObj) : getLabelForMonth(dObj));
            distanceData.push(group.distance);
            durationData.push(group.duration);
            repsData.push(group.reps);
            roundsData.push(group.rounds);
            repsLeftData.push(group.repsLeft);
            repsRightData.push(group.repsRight);
            maxDurationSecData.push(group.maxDurationSec);
        }
    });

    const datasets = [];
    const colors = {
        distance: { border: 'rgba(54, 162, 235, 1)', bg: 'rgba(54, 162, 235, 0.2)', label: 'Distanz (km)' },
        duration: { border: 'rgba(255, 99, 132, 1)', bg: 'rgba(255, 99, 132, 0.2)', label: 'Dauer (Minuten)' },
        reps: { border: 'rgba(75, 192, 192, 1)', bg: 'rgba(75, 192, 192, 0.2)', label: 'Wiederholungen' },
        rounds: { border: 'rgba(153, 102, 255, 1)', bg: 'rgba(153, 102, 255, 0.2)', label: 'Runden' },
        repsLeft: { border: 'rgba(255, 159, 64, 1)', bg: 'rgba(255, 159, 64, 0.2)', label: 'Wiederholungen (Links)' },
        repsRight: { border: 'rgba(201, 203, 207, 1)', bg: 'rgba(201, 203, 207, 0.2)', label: 'Wiederholungen (Rechts)' },
        maxDurationSec: { border: 'rgba(255, 205, 86, 1)', bg: 'rgba(255, 205, 86, 0.2)', label: 'Maximale Dauer (Sekunden)' }
    };

    let needsSecondaryAxis = false;

    // Check which stats are available and push to datasets
    if (statInfo.totals.distance > 0 || distanceData.some(d => d > 0)) {
        datasets.push({
            label: colors.distance.label,
            data: distanceData,
            borderColor: colors.distance.border,
            backgroundColor: colors.distance.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.distance.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    if (statInfo.totals.duration > 0 || durationData.some(d => d > 0)) {
        const useSecondary = datasets.length > 0;
        if (useSecondary) needsSecondaryAxis = true;

        datasets.push({
            label: colors.duration.label,
            data: durationData,
            borderColor: colors.duration.border,
            backgroundColor: colors.duration.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.duration.border,
            tension: 0.3,
            fill: true,
            yAxisID: useSecondary ? 'y1' : 'y'
        });
    }

    if (statInfo.totals.reps > 0 || repsData.some(d => d > 0)) {
        datasets.push({
            label: colors.reps.label,
            data: repsData,
            borderColor: colors.reps.border,
            backgroundColor: colors.reps.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.reps.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    if (statInfo.totals.rounds > 0 || roundsData.some(d => d > 0)) {
        datasets.push({
            label: colors.rounds.label,
            data: roundsData,
            borderColor: colors.rounds.border,
            backgroundColor: colors.rounds.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.rounds.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    if (statInfo.totals.repsLeft > 0 || repsLeftData.some(d => d > 0)) {
        datasets.push({
            label: colors.repsLeft.label,
            data: repsLeftData,
            borderColor: colors.repsLeft.border,
            backgroundColor: colors.repsLeft.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.repsLeft.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    if (statInfo.totals.repsRight > 0 || repsRightData.some(d => d > 0)) {
        datasets.push({
            label: colors.repsRight.label,
            data: repsRightData,
            borderColor: colors.repsRight.border,
            backgroundColor: colors.repsRight.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.repsRight.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    if (statInfo.totals.maxDurationSec > 0 || maxDurationSecData.some(d => d > 0)) {
        datasets.push({
            label: colors.maxDurationSec.label,
            data: maxDurationSecData,
            borderColor: colors.maxDurationSec.border,
            backgroundColor: colors.maxDurationSec.bg,
            borderWidth: 2,
            pointBackgroundColor: colors.maxDurationSec.border,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        });
    }

    const ctx = document.getElementById('exerciseChart').getContext('2d');

    if (currentChart) {
        currentChart.destroy();
    }

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim();

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: textColor }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    ticks: { color: textColor }
                },
                y1: {
                    type: 'linear',
                    display: needsSecondaryAxis,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false // only want the grid lines for one axis to show up
                    },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

// Settings & Custom Exercise Logic
function setupSettingsView() {
    const availableZone = document.getElementById('dnd-available');
    const selectedZone = document.getElementById('dnd-selected');
    const form = document.getElementById('create-exercise-form');

    // Populate available inputs
    availableZone.innerHTML = '';
    Object.keys(appData.inputDefinitions).forEach(inputId => {
        const def = appData.inputDefinitions[inputId];
        const el = document.createElement('div');
        el.className = 'dnd-item';
        el.draggable = true;
        el.dataset.id = inputId;
        el.textContent = def.label;
        el.style.cursor = 'pointer'; // Indicate it's clickable

        // Touch/Click support for mobile
        el.addEventListener('click', function () {
            if (this.parentElement.id === 'dnd-available') {
                const placeholder = selectedZone.querySelector('.placeholder-text');
                if (placeholder) placeholder.remove();
                selectedZone.appendChild(this);
            } else {
                availableZone.appendChild(this);
                if (selectedZone.children.length === 0) {
                    selectedZone.innerHTML = '<p class="placeholder-text">Ziehe Felder hierher</p>';
                }
            }
        });

        availableZone.appendChild(el);
    });

    // Setup Drag and Drop event listeners
    let draggedItem = null;

    document.querySelectorAll('.dnd-item').forEach(item => {
        item.addEventListener('dragstart', function (e) {
            draggedItem = this;
            setTimeout(() => this.style.display = 'none', 0);
        });

        item.addEventListener('dragend', function (e) {
            setTimeout(() => {
                this.style.display = 'block';
                draggedItem = null;
            }, 0);
        });
    });

    const zones = [availableZone, selectedZone];

    zones.forEach(zone => {
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', function (e) {
            this.classList.remove('drag-over');
        });

        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            this.classList.remove('drag-over');

            if (draggedItem) {
                // Remove placeholder if it exists
                const placeholder = this.querySelector('.placeholder-text');
                if (placeholder) placeholder.remove();

                this.appendChild(draggedItem);

                // If moving from selected back to available, and selected is empty, add placeholder
                if (selectedZone.children.length === 0) {
                    selectedZone.innerHTML = '<p class="placeholder-text">Ziehe Felder hierher</p>';
                }
            }
        });
    });

    // Handle Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('new-ex-name').value;
        const catInput = document.getElementById('new-ex-cat').value;

        // Get all selected IDs from the selected drop zone
        const selectedItems = Array.from(selectedZone.querySelectorAll('.dnd-item'));
        const inputIds = selectedItems.map(item => item.dataset.id);

        if (inputIds.length === 0) {
            alert('Bitte wähle mindestens ein Eingabefeld (Parameter) aus.');
            return;
        }

        if (editingCustomExerciseId) {
            // Update existing custom exercise
            updateCustomExercise(editingCustomExerciseId, {
                name: nameInput,
                catId: catInput,
                inputs: inputIds
            });
        } else {
            // Create new custom exercise
            const newEx = saveCustomExercise({
                name: nameInput,
                catId: catInput,
                inputs: inputIds
            });
            // Add to active data list
            appData.exercises.push(newEx);
        }

        // Reset form and UI
        resetCustomExerciseForm();

        // Rerender lists
        renderExerciseList();
        renderCustomExercisesList();
    });

    // Handle Cancel Edit
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-edit-ex-btn';
    cancelBtn.className = 'nav-btn';
    cancelBtn.style.display = 'none';
    cancelBtn.style.marginTop = '1rem';
    cancelBtn.style.width = '100%';
    cancelBtn.textContent = 'Abbrechen';
    form.appendChild(cancelBtn);

    cancelBtn.addEventListener('click', () => {
        resetCustomExerciseForm();
    });
}

function resetCustomExerciseForm() {
    editingCustomExerciseId = null;
    const form = document.getElementById('create-exercise-form');
    form.reset();
    document.querySelector('#create-exercise-form .submit-btn').textContent = 'Übung speichern';
    document.getElementById('form-title').textContent = 'Neue Übung erstellen';
    document.getElementById('cancel-edit-ex-btn').style.display = 'none';

    // Move all items back to available zone
    const availableZone = document.getElementById('dnd-available');
    const selectedZone = document.getElementById('dnd-selected');
    const selectedItems = Array.from(selectedZone.querySelectorAll('.dnd-item'));

    selectedItems.forEach(item => availableZone.appendChild(item));
    selectedZone.innerHTML = '<p class="placeholder-text">Ziehe Felder hierher</p>';
}

function openEditCustomExerciseForm(ex) {
    editingCustomExerciseId = ex.id;

    // Scroll to top of settings view
    document.getElementById('view-settings').scrollTop = 0;
    window.scrollTo(0, 0);

    // Update UI headers and buttons
    document.getElementById('form-title').textContent = 'Übung bearbeiten';
    document.querySelector('#create-exercise-form .submit-btn').textContent = 'Änderungen speichern';
    document.getElementById('cancel-edit-ex-btn').style.display = 'block';

    // Fill inputs
    document.getElementById('new-ex-name').value = ex.name;
    document.getElementById('new-ex-cat').value = ex.catId;

    // Manage drag and drop zones
    const availableZone = document.getElementById('dnd-available');
    const selectedZone = document.getElementById('dnd-selected');

    // Clear selected zone placeholder
    selectedZone.innerHTML = '';

    // Move all items back to available first
    selectedZone.querySelectorAll('.dnd-item').forEach(item => availableZone.appendChild(item));

    // Then move the chosen ones to selected
    ex.inputs.forEach(inputId => {
        const item = availableZone.querySelector(`[data-id="${inputId}"]`);
        if (item) {
            selectedZone.appendChild(item);
        }
    });

    // Add placeholder back if nothing is selected (shouldn't happen for saved ones but safe to have)
    if (selectedZone.children.length === 0) {
        selectedZone.innerHTML = '<p class="placeholder-text">Ziehe Felder hierher</p>';
    }
}

function renderCustomExercisesList() {
    const listContainer = document.getElementById('custom-exercises-list');
    const archiveContainer = document.getElementById('archived-exercises-list');

    listContainer.innerHTML = '';
    if (archiveContainer) archiveContainer.innerHTML = '';

    const customEx = getCustomExercises();

    const activeExercises = customEx.filter(ex => !ex.archived);
    const archivedExercises = customEx.filter(ex => ex.archived);

    // Active
    if (activeExercises.length === 0) {
        listContainer.innerHTML = '<p>Noch keine Übungen hier.</p>';
    } else {
        // Removed alphabetical sort to respect user's custom order

        let draggedNode = null;

        activeExercises.forEach((ex, index) => {
            const item = document.createElement('div');
            item.className = `custom-ex-item ${ex.catId}`;
            item.style.cursor = 'grab';
            item.title = "Klicken zum Bearbeiten, Ziehen zum Sortieren";
            item.draggable = true;
            item.dataset.id = ex.id;

            // Drag and Drop Logic for Sorting
            item.addEventListener('dragstart', function (e) {
                draggedNode = this;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Need a small timeout so the element doesn't disappear immediately while dragging
                setTimeout(() => this.style.opacity = '0.5', 0);
            });

            item.addEventListener('dragend', function () {
                draggedNode = null;
                this.classList.remove('dragging');
                this.style.opacity = '1';
                document.querySelectorAll('.custom-ex-item').forEach(el => {
                    el.style.borderTop = 'none';
                    el.style.borderBottom = 'none';
                });
            });

            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedNode && draggedNode !== this) {
                    // Reset all borders
                    document.querySelectorAll('.custom-ex-item').forEach(el => {
                        el.style.borderTop = 'none';
                        el.style.borderBottom = 'none';
                    });

                    // Determine mouse position relative to center of target
                    const bounding = this.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);

                    // Note: mobile drag-drop polyfill touch events use clientY too, but sometimes pageY. 
                    // e.clientY works for modern native drag and drop.
                    const yPos = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

                    if (yPos - offset > 0) {
                        this.style.borderBottom = '8px solid var(--text-color)';
                        this.dataset.dropPosition = 'after';
                    } else {
                        this.style.borderTop = '8px solid var(--text-color)';
                        this.dataset.dropPosition = 'before';
                    }
                }
            });

            item.addEventListener('dragleave', function () {
                this.style.borderTop = 'none';
                this.style.borderBottom = 'none';
                delete this.dataset.dropPosition;
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                const dropPos = this.dataset.dropPosition;
                this.style.borderTop = 'none';
                this.style.borderBottom = 'none';
                delete this.dataset.dropPosition;

                if (draggedNode && draggedNode !== this) {
                    const draggedId = draggedNode.dataset.id;
                    const targetId = this.dataset.id;

                    // Reorder in memory
                    let exercises = getCustomExercises();
                    const draggedIndex = exercises.findIndex(e => e.id === draggedId);

                    if (draggedIndex > -1) {
                        const [movedEx] = exercises.splice(draggedIndex, 1);

                        // Recalculate target index because array length changed
                        let newTargetIndex = exercises.findIndex(e => e.id === targetId);

                        if (dropPos === 'after') {
                            newTargetIndex += 1;
                        }

                        exercises.splice(newTargetIndex, 0, movedEx);

                        // Save new order
                        localStorage.setItem('training_tracker_custom_exercises', JSON.stringify(exercises));
                        appData.exercises = exercises;

                        // Re-render
                        renderCustomExercisesList();
                        renderExerciseList();
                    }
                }
            });

            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = "<span style='font-size: 1.8rem; margin-right: 15px; flex-shrink: 0;'>☰</span> <span style='word-break: break-word;'>" + ex.name + "</span>";
            titleSpan.style.fontWeight = 'bold';
            titleSpan.style.display = 'flex';
            titleSpan.style.alignItems = 'center';
            titleSpan.style.flex = '1 1 150px';
            titleSpan.style.minWidth = '0';

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.textContent = 'Archivieren';
            delBtn.style.flex = '0 0 auto';

            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteModal(ex);
            });

            item.addEventListener('click', () => {
                openEditCustomExerciseForm(ex);
            });

            item.appendChild(titleSpan);
            item.appendChild(delBtn);
            listContainer.appendChild(item);
        });
    }

    // Archived
    if (archiveContainer) {
        if (archivedExercises.length === 0) {
            archiveContainer.innerHTML = '<p>Keine Übungen im Archiv.</p>';
        } else {
            archivedExercises.sort((a, b) => a.name.localeCompare(b.name));
            archivedExercises.forEach(ex => {
                const item = document.createElement('div');
                item.className = `custom-ex-item ${ex.catId}`;
                item.style.opacity = '0.6';

                const titleSpan = document.createElement('span');
                titleSpan.textContent = ex.name;
                titleSpan.style.fontWeight = 'bold';
                titleSpan.style.flex = '1 1 150px';
                titleSpan.style.minWidth = '0';
                titleSpan.style.wordBreak = 'break-word';

                const btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex';
                btnContainer.style.gap = '0.5rem';
                btnContainer.style.flexWrap = 'wrap';
                btnContainer.style.flex = '0 0 auto';

                const restoreBtn = document.createElement('button');
                restoreBtn.type = 'button';
                restoreBtn.textContent = 'Wiederherstellen';
                restoreBtn.style.backgroundColor = 'var(--cat-green)';
                restoreBtn.style.color = 'white';
                restoreBtn.style.border = 'none';
                restoreBtn.style.padding = '0.5rem 1rem';
                restoreBtn.style.borderRadius = '6px';
                restoreBtn.style.cursor = 'pointer';

                restoreBtn.addEventListener('click', () => {
                    unarchiveCustomExercise(ex.id);
                    if (appData.exercises) {
                        const appIndex = appData.exercises.findIndex(e => e.id === ex.id);
                        if (appIndex !== -1) appData.exercises[appIndex].archived = false;
                    }
                    renderCustomExercisesList();
                    renderExerciseList();
                });

                const hardDeleteBtn = document.createElement('button');
                hardDeleteBtn.type = 'button';
                hardDeleteBtn.textContent = 'Endgültig löschen';
                hardDeleteBtn.style.backgroundColor = 'var(--cat-red)';
                hardDeleteBtn.style.color = 'white';
                hardDeleteBtn.style.border = 'none';
                hardDeleteBtn.style.padding = '0.5rem 1rem';
                hardDeleteBtn.style.borderRadius = '6px';
                hardDeleteBtn.style.cursor = 'pointer';

                hardDeleteBtn.addEventListener('click', () => {
                    showHardDeleteModal(ex);
                });

                btnContainer.appendChild(restoreBtn);
                btnContainer.appendChild(hardDeleteBtn);

                item.appendChild(titleSpan);
                item.appendChild(btnContainer);
                archiveContainer.appendChild(item);
            });
        }
    }
}


function showDeleteModal(ex) {
    const modal = document.getElementById('delete-confirm-modal');
    const textNode = document.getElementById('delete-custom-modal-text');
    const titleNode = document.getElementById('delete-modal-title');
    const cancelBtn = document.getElementById('delete-modal-cancel');
    const confirmBtn = document.getElementById('delete-modal-confirm');

    titleNode.textContent = 'Übung archivieren?';
    confirmBtn.textContent = 'Archivieren';
    textNode.textContent = `Möchtest du diese Übung archivieren? Sie verschwindet aus "Trainieren", aber deine bisherigen Messwerte bleiben erhalten.`;
    modal.style.display = 'flex';

    // Clear previous event listeners by cloning nodes
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';

        // Reset text
        titleNode.textContent = 'Übung löschen?';
        confirmBtn.textContent = 'Löschen';
    });

    newConfirmBtn.addEventListener('click', () => {
        modal.style.display = 'none';

        // Reset text
        titleNode.textContent = 'Übung löschen?';
        confirmBtn.textContent = 'Löschen';

        if (editingCustomExerciseId === ex.id) {
            resetCustomExerciseForm();
        }

        archiveCustomExercise(ex.id);

        if (appData.exercises) {
            const appIndex = appData.exercises.findIndex(e => e.id === ex.id);
            if (appIndex !== -1) appData.exercises[appIndex].archived = true;
        }

        renderCustomExercisesList();
        renderExerciseList();
    });
}

function showHardDeleteModal(ex) {
    const modal = document.getElementById('hard-delete-modal');
    const cancelBtn = document.getElementById('hard-delete-modal-cancel');
    const confirmBtn = document.getElementById('hard-delete-modal-confirm');

    modal.style.display = 'flex';

    // Clear previous event listeners by cloning nodes
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    newConfirmBtn.addEventListener('click', () => {
        modal.style.display = 'none';

        let entries = getAllEntries();
        entries = entries.filter(e => e.exerciseId !== ex.id);

        // Correct LOCAL STORAGE KEY!
        localStorage.setItem('training_tracker_data', JSON.stringify(entries));
        appData.entries = entries;

        deleteCustomExercise(ex.id);
        appData.exercises = appData.exercises.filter(e => e.id !== ex.id);

        renderCustomExercisesList();
        renderExerciseList();
        renderDashboard();
    });
}

// Start App
document.addEventListener('DOMContentLoaded', init);
