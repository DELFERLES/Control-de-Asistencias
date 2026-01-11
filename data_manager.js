import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'attendance_app_data';

// Initial structure if nothing is found in localStorage
const defaultState = {
    sections: [],
    subjects: []
};

let appState = loadState();

function sortStudents(section) {
    section.students.sort((a, b) => {
        // Sort by last name, then by first name
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    });
}

function loadState() {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) {
            console.log("Initializing default state.");
            return defaultState;
        }
        const loadedState = JSON.parse(serializedState);

        // Ensure subjects structure exists
        if (!Array.isArray(loadedState.subjects)) {
            const defaultSubjectId = uuidv4();
            loadedState.subjects = [
                {
                    id: defaultSubjectId,
                    name: 'General'
                }
            ];
            // Assign all existing sections to the default subject if they have none
            if (Array.isArray(loadedState.sections)) {
                loadedState.sections.forEach(section => {
                    if (!section.subjectId) {
                        section.subjectId = defaultSubjectId;
                    }
                });
            }
        } else {
            // Ensure all sections have a subjectId; assign first subject as fallback
            const fallbackSubjectId = loadedState.subjects[0]?.id || uuidv4();
            if (!loadedState.subjects.length) {
                loadedState.subjects.push({ id: fallbackSubjectId, name: 'General' });
            }
            if (Array.isArray(loadedState.sections)) {
                loadedState.sections.forEach(section => {
                    if (!section.subjectId) {
                        section.subjectId = fallbackSubjectId;
                    }
                });
            }
        }
        
        // Migrate/initialize gender field if missing
        loadedState.sections.forEach(section => {
            // Ensure attendance object exists
            if (!section.attendance) {
                section.attendance = {};
            }

            // Ensure lateTimes object exists (to store time for tardies)
            if (!section.lateTimes) {
                section.lateTimes = {};
            }

            // Ensure startDate field exists (for custom attendance start date)
            if (!('startDate' in section)) {
                section.startDate = null;
            }

            // NEW: Ensure visibleWeekdays field exists (1=Mon ... 5=Fri)
            if (!Array.isArray(section.visibleWeekdays) || section.visibleWeekdays.length === 0) {
                // Preserve previous behavior for specific named sections if applicable
                if (section.name === '2do Año A' || section.name === '2do Año B') {
                    section.visibleWeekdays = [1, 2]; // Lunes y Martes
                } else if (section.name === '2do Año C') {
                    section.visibleWeekdays = [3, 4]; // Miércoles y Jueves
                } else {
                    section.visibleWeekdays = [1, 2, 3, 4, 5]; // Default: Lunes a Viernes
                }
            }

            section.students.forEach(student => {
                if (!student.gender) {
                    student.gender = 'U'; // Unknown
                }
            });
            sortStudents(section);
        });
        
        return loadedState;
    } catch (e) {
        console.error("Error loading state:", e);
        return defaultState;
    }
}

function saveState() {
    try {
        const serializedState = JSON.stringify(appState);
        localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (e) {
        console.error("Error saving state:", e);
    }
}

 // --- Subject Management ---

function getSubjects() {
    return appState.subjects;
}

function addSubject(name) {
    const newSubject = {
        id: uuidv4(),
        name: name
    };
    appState.subjects.push(newSubject);
    saveState();
    return newSubject;
}

function updateSubjectName(subjectId, newName) {
    const subject = appState.subjects.find(s => s.id === subjectId);
    if (subject) {
        subject.name = newName;
        saveState();
    }
}

function deleteSubject(subjectId) {
    // Remove all sections that belong to this subject
    appState.sections = appState.sections.filter(s => s.subjectId !== subjectId);
    // Remove the subject itself
    appState.subjects = appState.subjects.filter(s => s.id !== subjectId);
    saveState();
}

// --- Section Management ---

function getSections() {
    return appState.sections;
}

function getSection(sectionId) {
    return appState.sections.find(s => s.id === sectionId);
}

function addSection(name, subjectId = null) {
    const newSection = {
        id: uuidv4(),
        name: name,
        subjectId: subjectId, // Materia a la que pertenece la sección
        students: [],
        attendance: {},
        lateTimes: {}, // Hora registrada para retardos: { [date]: { [studentId]: "HH:MM" } }
        startDate: null, // Custom start date for attendance map (YYYY-MM-DD) or null
        visibleWeekdays: [1, 2, 3, 4, 5] // Lunes a Viernes visibles por defecto
    };
    appState.sections.push(newSection);
    saveState();
    return newSection;
}

function updateSectionName(sectionId, newName, newSubjectId = null) {
    const section = getSection(sectionId);
    if (section) {
        section.name = newName;
        if (newSubjectId !== null) {
            section.subjectId = newSubjectId;
        }
        saveState();
    }
}

function deleteSection(sectionId) {
    appState.sections = appState.sections.filter(s => s.id !== sectionId);
    saveState();
}

/**
 * Sets the custom start date for the attendance map of a section.
 * dateStr should be in YYYY-MM-DD format or null to clear.
 */
function setSectionStartDate(sectionId, dateStr) {
    const section = getSection(sectionId);
    if (section) {
        section.startDate = dateStr || null;
        saveState();
    }
}

/**
 * Sets which weekdays (1=Mon ... 5=Fri) are visible in the attendance map for a section.
 */
function setSectionVisibleWeekdays(sectionId, weekdaysArray) {
    const section = getSection(sectionId);
    if (section) {
        // Normalize: only keep unique integers between 1 and 5
        const cleaned = Array.from(new Set((weekdaysArray || []).map(Number)))
            .filter(d => d >= 1 && d <= 5)
            .sort((a, b) => a - b);
        section.visibleWeekdays = cleaned.length ? cleaned : [1, 2, 3, 4, 5];
        saveState();
    }
}

/**
 * Clears all attendance records for the given section.
 */
function clearAttendance(sectionId) {
    const section = getSection(sectionId);
    if (section) {
        section.attendance = {};
        // También limpiamos los tiempos de retardos
        if (section.lateTimes) {
            section.lateTimes = {};
        }
        saveState();
    }
}

// --- Student Management ---

function addStudent(sectionId, firstName, lastName, gender = 'U', birthday = null) { // U: Unknown/Other
    const section = getSection(sectionId);
    if (section) {
        const newStudent = {
            id: uuidv4(),
            firstName: firstName,
            lastName: lastName,
            gender: gender, // 'M', 'F', or 'U'
            birthday: birthday || null // YYYY-MM-DD or null
        };
        section.students.push(newStudent);
        sortStudents(section);
        saveState();
        return newStudent;
    }
}

function updateStudent(sectionId, studentId, firstName, lastName, gender, birthday = null) {
    const section = getSection(sectionId);
    if (section) {
        const student = section.students.find(s => s.id === studentId);
        if (student) {
            student.firstName = firstName;
            student.lastName = lastName;
            // Update gender if provided
            if (gender) {
                student.gender = gender;
            }
            // Update birthday (can be null to clear)
            student.birthday = birthday || null;
            sortStudents(section);
            saveState();
        }
    }
}

function deleteStudent(sectionId, studentId) {
    const section = getSection(sectionId);
    if (section) {
        // Remove student from list
        section.students = section.students.filter(s => s.id !== studentId);

        // Remove student's attendance records
        for (const date in section.attendance) {
            if (section.attendance[date][studentId]) {
                delete section.attendance[date][studentId];
            }
        }
        saveState();
    }
}

function getStudents(sectionId) {
    const section = getSection(sectionId);
    return section ? section.students : [];
}

// --- Attendance Management ---

// Status codes: P (Present), A (Absent), L (Late), U (Unmarked)
const ATTENDANCE_STATUSES = ['U', 'P', 'A', 'L']; 
// Cycle is U -> P -> A -> L -> U

function setAttendanceStatus(sectionId, studentId, date, status) {
    const section = getSection(sectionId);
    // ATTENDANCE_STATUSES includes 'U', 'P', 'A', 'L'
    if (!section || !ATTENDANCE_STATUSES.includes(status)) return;

    if (!section.attendance[date]) {
        section.attendance[date] = {};
    }
    if (!section.lateTimes) {
        section.lateTimes = {};
    }
    if (!section.lateTimes[date]) {
        section.lateTimes[date] = {};
    }

    if (status === 'U') {
        // Optimization: delete the entry if it reverts to unmarked
        delete section.attendance[date][studentId];
        if (Object.keys(section.attendance[date]).length === 0) {
            delete section.attendance[date];
        }
        // También eliminamos cualquier hora de retardo guardada
        if (section.lateTimes[date] && section.lateTimes[date][studentId]) {
            delete section.lateTimes[date][studentId];
            if (Object.keys(section.lateTimes[date]).length === 0) {
                delete section.lateTimes[date];
            }
        }
    } else {
        section.attendance[date][studentId] = status;
        // Si es retardo, guardamos la hora actual; en otros casos, borramos posible hora previa
        if (status === 'L') {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            section.lateTimes[date][studentId] = `${hours}:${minutes}`;
        } else {
            if (section.lateTimes[date] && section.lateTimes[date][studentId]) {
                delete section.lateTimes[date][studentId];
                if (Object.keys(section.lateTimes[date]).length === 0) {
                    delete section.lateTimes[date];
                }
            }
        }
    }

    saveState();
    return status;
}

/**
 * Cycles attendance status U -> P -> A -> L -> U
 */
function toggleAttendance(sectionId, studentId, date) {
    const section = getSection(sectionId);
    if (!section) return;

    if (!section.attendance[date]) {
        section.attendance[date] = {};
    }

    let currentStatus = section.attendance[date][studentId] || 'U';

    // Find the next status in the cycle 
    const currentIndex = ATTENDANCE_STATUSES.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % ATTENDANCE_STATUSES.length;
    const nextStatus = ATTENDANCE_STATUSES[nextIndex];

    return setAttendanceStatus(sectionId, studentId, date, nextStatus);
}

function getAttendanceRecords(sectionId) {
    const section = getSection(sectionId);
    return section ? section.attendance : {};
}

/**
 * Devuelve el objeto de tiempos de retardo para una sección:
 * { [date]: { [studentId]: "HH:MM" } }
 */
function getLateTimes(sectionId) {
    const section = getSection(sectionId);
    return section && section.lateTimes ? section.lateTimes : {};
}

// --- Date Utilities ---

/**
 * Returns an array of formatted dates (YYYY-MM-DD) between start and end,
 * excluding weekends (Saturday and Sunday).
 * Dates are processed using UTC methods to ensure consistency regardless of local timezone.
 */
function getBusinessDays(startDateStr, endDateStr) {
    // We parse the YYYY-MM-DD string as UTC midnight to avoid local timezone shifts changing the day.
    const startDate = new Date(startDateStr + 'T00:00:00Z');
    const endDate = new Date(endDateStr + 'T00:00:00Z');
    
    if (isNaN(startDate) || isNaN(endDate)) return [];

    const dates = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 6 = Saturday
        
        // Check if it's Monday (1) through Friday (5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            dates.push(current.toISOString().split('T')[0]);
        }

        // Move to the next day
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
}

export {
    getSubjects,
    getSections,
    getSection,
    addSection,
    updateSectionName,
    deleteSection,
    addSubject,
    updateSubjectName,
    deleteSubject,
    addStudent,
    updateStudent,
    deleteStudent,
    getStudents,
    toggleAttendance,
    setAttendanceStatus,
    getAttendanceRecords,
    getBusinessDays,
    setSectionStartDate,
    clearAttendance,
    setSectionVisibleWeekdays,
    getLateTimes
};