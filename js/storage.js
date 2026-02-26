const STORAGE_KEY = 'training_tracker_data';

// Initialize storage structure if not exists
function initStorage() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
}

// Get all entries
function getAllEntries() {
    initStorage();
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

// --- Custom Exercises Logic ---
const CUSTOM_EXERCISES_KEY = 'training_tracker_custom_exercises';

function initCustomExercisesStorage() {
    if (!localStorage.getItem(CUSTOM_EXERCISES_KEY)) {
        localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify([]));
    }
}

function getCustomExercises() {
    initCustomExercisesStorage();
    return JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY));
}

function saveCustomExercise(exerciseData) {
    const exercises = getCustomExercises();

    // Create new exercise object
    const newExercise = {
        id: 'cust-' + Date.now().toString(),
        catId: exerciseData.catId,
        name: exerciseData.name,
        inputs: exerciseData.inputs,
        isCustom: true
    };

    exercises.push(newExercise);
    localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
    return newExercise;
}

function deleteCustomExercise(id) {
    let exercises = getCustomExercises();
    exercises = exercises.filter(e => e.id !== id);
    localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}

function updateCustomExercise(id, updatedData) {
    let exercises = getCustomExercises();
    const index = exercises.findIndex(e => e.id === id);
    if (index !== -1) {
        if (updatedData.name !== undefined) exercises[index].name = updatedData.name;
        if (updatedData.catId !== undefined) exercises[index].catId = updatedData.catId;
        if (updatedData.inputs !== undefined) exercises[index].inputs = updatedData.inputs;
        if (updatedData.archived !== undefined) exercises[index].archived = updatedData.archived;
        localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));

        // Also update the active appData.exercises list if it's there
        if (typeof appData !== 'undefined' && appData.exercises) {
            const appIndex = appData.exercises.findIndex(e => e.id === id);
            if (appIndex !== -1) {
                if (updatedData.name !== undefined) appData.exercises[appIndex].name = updatedData.name;
                if (updatedData.catId !== undefined) appData.exercises[appIndex].catId = updatedData.catId;
                if (updatedData.inputs !== undefined) appData.exercises[appIndex].inputs = updatedData.inputs;
                if (updatedData.archived !== undefined) appData.exercises[appIndex].archived = updatedData.archived;
            }
        }
    }
}

// Save a new entry
function saveEntry(entryData, targetDateStr = null) {
    const entries = getAllEntries();

    let dateStr = targetDateStr;
    let timestamp = Date.now();

    if (!dateStr) {
        // If no date provided, use today and current time
        const now = new Date();
        dateStr = formatDateToLocalString(now);
    } else {
        // If a specific date is provided, generate a timestamp for noon on that day
        timestamp = new Date(dateStr + 'T12:00:00').getTime();
        // Fallback if Date parsing fails on some older browsers
        if (isNaN(timestamp)) timestamp = Date.now();
    }

    // Create entry object
    const newEntry = {
        id: Date.now().toString(),
        date: dateStr,
        timestamp: timestamp,
        exerciseId: entryData.exerciseId,
        catId: entryData.catId,
        inputs: entryData.inputs
    };

    entries.push(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return newEntry;
}

// Delete an entry by ID
function deleteEntry(id) {
    let entries = getAllEntries();
    entries = entries.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Update an existing entry
function updateEntry(id, newEntryData) {
    let entries = getAllEntries();
    const index = entries.findIndex(e => e.id === id);
    if (index !== -1) {
        entries[index].exerciseId = newEntryData.exerciseId;
        entries[index].catId = newEntryData.catId;
        entries[index].inputs = newEntryData.inputs;
        // Keep date and timestamp the same
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
}

// Get entries for a specific date string (YYYY-MM-DD)
function getEntriesForDate(dateString) {
    const entries = getAllEntries();
    return entries.filter(entry => entry.date.startsWith(dateString));
}

// Helper: Format Date to YYYY-MM-DD
function formatDateToLocalString(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const m = String(d.getMonth() + 1);
    const dayStr = String(d.getDate());
    const month = m.length < 2 ? '0' + m : m;
    const day = dayStr.length < 2 ? '0' + dayStr : dayStr;
    return `${year}-${month}-${day}`;
}

// Week Navigation State
let currentWeekOffset = 0; // 0 = this week, -1 = last week, etc.

function getWeekOffset() {
    return currentWeekOffset;
}

function changeWeekOffset(delta) {
    currentWeekOffset += delta;
}

function resetWeekOffset() {
    currentWeekOffset = 0;
}

// Get entries for the currently selected week (Monday to Sunday)
function getEntriesForCurrentWeek() {
    const today = new Date();
    // JS getDay() is 0 (Sun) to 6 (Sat). We want Monday=0
    let dayOfWeek = today.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    // Apply week offset
    diffToMonday += (currentWeekOffset * 7);

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const entries = getAllEntries();
    const weekEntries = [];

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        const dateStr = formatDateToLocalString(currentDate);

        // Find all entries for this date
        const dayEntries = entries.filter(e => e.date.startsWith(dateStr));
        weekEntries.push({
            date: dateStr,
            dayObj: currentDate,
            entries: dayEntries
        });
    }

    return weekEntries;
}

function archiveCustomExercise(id) {
    updateCustomExercise(id, { archived: true });
}

function unarchiveCustomExercise(id) {
    updateCustomExercise(id, { archived: false });
}
