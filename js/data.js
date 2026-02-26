// App data mapping from the analog training plan
const defaultExercises = [
    // Gelb (Yellow)
    { id: 'ex-1', catId: 'cat-yellow', name: 'Beintraining - MOTOmed', inputs: ['duration', 'distance'] },
    { id: 'ex-2', catId: 'cat-yellow', name: 'Armtraining - MOTOmed', inputs: ['duration', 'distance'] },
    { id: 'ex-3', catId: 'cat-yellow', name: 'Gehtrainer (Küchentisch)', inputs: ['rounds'] },

    // Orange
    { id: 'ex-4', catId: 'cat-orange', name: 'Armtraining (Seilzug)', inputs: ['duration'] },
    { id: 'ex-5', catId: 'cat-orange', name: 'Handübungen (Handschuh)', inputs: ['duration'] },
    { id: 'ex-6', catId: 'cat-orange', name: 'Stehübungen (Spültisch)', inputs: ['repsLeft', 'repsRight'] },

    // Rot (Red)
    { id: 'ex-7', catId: 'cat-red', name: 'Atemübungen', inputs: ['maxDurationSec', 'reps'] },

    // Grün (Green)
    { id: 'ex-8', catId: 'cat-green', name: 'Rollstuhl: Mit Füßen abstoßen', inputs: ['duration', 'notes'] },
    { id: 'ex-9', catId: 'cat-green', name: 'Rollstuhl: Vornüberbeugen', inputs: ['reps'] },
    { id: 'ex-10', catId: 'cat-green', name: 'Rollstuhl: Wand Armdrücken', inputs: ['reps'] },

    // Blau (Blue)
    { id: 'ex-11', catId: 'cat-blue', name: 'Gedächtnisübungen (Neuronation)', inputs: ['duration'] },
    { id: 'ex-12', catId: 'cat-blue', name: 'Singen (Lyrics)', inputs: ['duration'] }
];

const appData = {
    categories: [
        { id: 'cat-yellow', colorClass: 'cat-yellow', name: 'Ausdauer & Beine' },
        { id: 'cat-orange', colorClass: 'cat-orange', name: 'Kraft & Motorik' },
        { id: 'cat-red', colorClass: 'cat-red', name: 'Atmung' },
        { id: 'cat-green', colorClass: 'cat-green', name: 'Rumpf & Rollstuhl' },
        { id: 'cat-blue', colorClass: 'cat-blue', name: 'Geist & Stimme' }
    ],
    exercises: [], // Populated dynamically by loadCustomExercises
    inputDefinitions: {
        duration: { type: 'number', label: 'Dauer (Minuten)', step: '1' },
        maxDurationSec: { type: 'number', label: 'Maximale Dauer (Sekunden)', step: '1' },
        distance: { type: 'number', label: 'Distanz (km)', step: '0.1' },
        reps: { type: 'number', label: 'Anzahl (Wiederholungen)', step: '1' },
        rounds: { type: 'number', label: 'Runden (Wiederholungen)', step: '1' },
        repsLeft: { type: 'number', label: 'Anzahl (links)', step: '1' },
        repsRight: { type: 'number', label: 'Anzahl (rechts)', step: '1' },
        notes: { type: 'text', label: 'Notizen (Optional)' }
    }
};

// Load custom exercises from localStorage
function loadCustomExercises() {
    try {
        if (typeof getCustomExercises === 'function') {
            const MIGRATION_KEY = 'training_tracker_migrated_v3';
            let customEx = getCustomExercises() || [];

            // Perform one-time migration of default seeds if needed
            if (!localStorage.getItem(MIGRATION_KEY)) {
                const customIds = customEx.map(e => e.id);
                let addedAny = false;

                defaultExercises.forEach(ex => {
                    if (!customIds.includes(ex.id)) {
                        ex.isCustom = true;
                        customEx.push(ex);
                        addedAny = true;
                    }
                });

                if (addedAny) {
                    localStorage.setItem('training_tracker_custom_exercises', JSON.stringify(customEx));
                }
                localStorage.setItem(MIGRATION_KEY, 'true');
            }

            // Set all active exercises to the ones managed in local storage
            appData.exercises = customEx;
        }
    } catch (e) {
        console.error("Error loading custom exercises: ", e);
    }
}// Helper function to get an exercise by ID
function getExerciseById(id) {
    return appData.exercises.find(ex => ex.id === id);
}

// Helper to get category by ID
function getCategoryById(id) {
    return appData.categories.find(cat => cat.id === id);
}
