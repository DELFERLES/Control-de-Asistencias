import { html, render } from 'lit-html';
import jsPDF from 'jspdf';
import * as DataManager from './data_manager.js';

const APP_CONTAINER = document.getElementById('app-container');

// --- Global State & Router ---
const state = {
    currentView: 'sections', // 'sections' | 'detail'
    selectedSectionId: null,
    selectedSubjectId: null,
    modal: null, // 'addSection' | 'addStudent' | 'editStudent' | 'editSection' | 'addSubject' | 'editSubject' | null
    editingStudent: null, // Student object for editing
    editingSection: null, // Section object for name edit
    editingSubject: null, // Subject object for edit
    showStudentList: false, // New state for toggling student list visibility
    // --- NEW: History view state ---
    history: {
        sectionId: null,
        filter: '7',       // '7' | '14' | '30' | 'custom'
        customStart: '',
        customEnd: '',
        studentFilter: ''  // texto para filtrar por alumno
    },
    // contexto para mostrar lista de retardos
    lateContext: {
        sectionId: null,
        date: null
    },
    // NEW: control to show only today or full map
    showFullMap: false,
    // NEW: momento de inicio (I, II, III)
    inicioMomento: 'I',
    // Track which section/date alarms have been played to avoid repeating
    birthdayAlarmPlayed: {} // { [sectionId]: 'YYYY-MM-DD' }
};

// --- Utilities ---
function navigate(view, sectionId = null) {
    state.currentView = view;
    state.selectedSectionId = sectionId;
    closeModal(); // Close any open modal on navigation
    
    // Reset student list visibility when navigating to a new section detail
    if (view === 'detail') {
        state.showStudentList = false;
        // Siempre iniciar mostrando solo el día actual
        state.showFullMap = false;
    }
    
    renderApp();
}

function openModal(modalType, data = null) {
    state.modal = modalType;
    if (modalType === 'editStudent' && data) {
        state.editingStudent = data;
    }
    if (modalType === 'editSection' && data) {
        state.editingSection = data;
    }
    if (modalType === 'editSubject' && data) {
        state.editingSubject = data;
    }
    if (modalType === 'weekdaySelector' && data) {
        state.editingSection = data;
    }
    renderApp();
}

function closeModal() {
    state.modal = null;
    state.editingStudent = null;
    state.editingSection = null;
    state.editingSubject = null;
    // Reset history state when closing history modal
    if (state.history) {
        state.history = {
            sectionId: null,
            filter: '7',
            customStart: '',
            customEnd: '',
            studentFilter: ''
        };
    }
    // Reset contexto de retardos
    state.lateContext = {
        sectionId: null,
        date: null
    };
    renderApp();
}

// New utility function for toggling student list visibility
function toggleStudentListVisibility() {
    state.showStudentList = !state.showStudentList;
    renderApp();
}

// --- NEW: Open history modal for a section ---
function openHistoryModal(sectionId) {
    state.history = {
        sectionId,
        filter: '7',
        customStart: '',
        customEnd: '',
        studentFilter: ''
    };
    state.modal = 'history';
    renderApp();
}

// --- Component Rendering ---

// --- 1. Section List View ---
const sectionListTemplate = (subjects, sections) => {
    const selectedSubjectId = state.selectedSubjectId;

    return html`
        <header>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <h1>Registro de Asistencia</h1>
                <button
                    class="secondary"
                    style="padding:6px 10px; font-size:0.8rem; min-height:36px;"
                    @click=${() => openModal('addSubject')}>
                    + Materia
                </button>
            </div>
        </header>
        <div class="main-content">
            ${(!subjects || subjects.length === 0) ? html`
                <p style="text-align: center; color: var(--color-text-light);">
                    Aún no tienes materias registradas. Agrega una materia para empezar.
                </p>
            ` : (!selectedSubjectId ? html`
                <!-- Vista de lista de materias -->
                ${subjects.map((subject, index) => html`
                    <section
                        class="card subject-card ${'subject-color-' + ((index % 6) + 1)}"
                        style="margin-bottom: 12px; cursor: default;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h2 style="font-size:1.05rem; margin-bottom:2px;">${subject.name}</h2>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button
                                    class="secondary"
                                    style="padding:0; font-size:0.9rem; width:32px; height:32px; min-height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center;"
                                    @click=${(e) => { e.stopPropagation(); openModal('editSubject', subject); }}>
                                    ✏️
                                </button>
                                <button
                                    style="padding:6px 10px; font-size:0.8rem; min-height:32px;"
                                    @click=${() => { state.selectedSubjectId = subject.id; renderApp(); }}>
                                    Entrar
                                </button>
                            </div>
                        </div>
                    </section>
                `)}
            ` : (() => {
                const subject = subjects.find(s => s.id === selectedSubjectId);
                const subjectSections = sections.filter(s => s.subjectId === selectedSubjectId);
                return html`
                    <!-- Vista de secciones de una materia -->
                    <section style="margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <button
                                class="secondary"
                                style="padding:4px 8px; font-size:0.8rem; min-height:32px;"
                                @click=${() => { state.selectedSubjectId = null; renderApp(); }}>
                                ← Materias
                            </button>
                            <span style="font-size:0.85rem; color:var(--color-text-light);">Materia seleccionada</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <h2 style="font-size:1.05rem;">${subject ? subject.name : ''}</h2>
                            ${subject ? html`
                                <button
                                    class="secondary"
                                    style="padding:4px 8px; font-size:0.8rem; min-height:32px;"
                                    @click=${(e) => { e.stopPropagation(); openModal('editSubject', subject); }}>
                                    ✏️
                                </button>
                            ` : null}
                        </div>
                        ${subjectSections.length === 0 ? html`
                            <p style="font-size:0.85rem; color:var(--color-text-light); margin-bottom:4px;">
                                No hay secciones en esta materia. Usa el botón + para añadir una.
                            </p>
                        ` : subjectSections.map((section, index) => sectionCard(section, index))}
                    </section>
                `;
            })())}
        </div>
        <button class="fab" @click=${() => openModal('addSection')}>+</button>
    `;
};

const sectionCard = (section, index) => {
    const students = DataManager.getStudents(section.id);
    const attendanceRecords = DataManager.getAttendanceRecords(section.id);
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords[today] || {};

    let presentCount = 0;
    let absentCount = 0;

    students.forEach(student => {
        const status = todayRecords[student.id] || 'U';
        // Igual que en el resumen: P, L y U cuentan como presentes visualmente; A como inasistente
        if (status === 'A') {
            absentCount++;
        } else {
            presentCount++;
        }
    });

    const totalMarked = presentCount + absentCount;
    let attendancePercent = '--';
    let absencePercent = '--';

    if (totalMarked > 0) {
        attendancePercent = ((presentCount / totalMarked) * 100).toFixed(2);
        absencePercent = (100 - parseFloat(attendancePercent)).toFixed(2);
    }

    // Find students with birthday today (if any) to show in the subbox
    const birthdayStudents = students.filter(s => isBirthday(s));

    const colorClass = `pastel-${(index % 4) + 1}`; // Cycle through pastel-1, pastel-2, pastel-3, pastel-4

    return html`
        <div class="card section-card ${colorClass}" @click=${() => navigate('detail', section.id)}>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2>${section.name}</h2>
                        <p>${students.length} alumnos registrados</p>
                    </div>
                    <button
                        class="secondary"
                        style="padding: 0; font-size: 0.95rem; width: 32px; height: 32px; min-height: 32px; border-radius: 8px; display:flex; align-items:center; justify-content:center;"
                        @click=${(e) => { e.stopPropagation(); openModal('editSection', section); }}>
                        <span role="img" aria-label="edit">✏️</span>
                    </button>
                </div>
                <div class="attendance-summary">
                    <div class="attendance-box attendance-box-present" style="flex-direction: column; align-items: flex-start; gap:6px;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <span>Asistencia</span>
                            <span>${attendancePercent === '--' ? '--' : attendancePercent + '%'}</span>
                        </div>
                    </div>
                    <div class="attendance-box attendance-box-absent">
                        <span>Inasistencia</span>
                        <span>${absencePercent === '--' ? '--' : absencePercent + '%'}</span>
                    </div>
                </div>

                ${birthdayStudents && birthdayStudents.length ? html`
                    <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                        ${birthdayStudents.map(bs => html`
                            <div class="card" style="padding:8px 10px; display:flex; align-items:center; gap:10px; background-color: var(--color-surface);">
                                <img src="/birthday_${bs.gender === 'F' ? 'pink' : 'blue'}.png" alt="Pastel" style="width:28px; height:28px;">
                                <div style="font-weight:700; font-size:0.9rem;">${bs.lastName}, ${bs.firstName}</div>
                            </div>
                        `)}
                    </div>
                ` : null}

                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button
                        class="secondary"
                        style="padding: 6px 12px; font-size: 0.9rem; min-height: 36px;"
                        @click=${(e) => { e.stopPropagation(); openHistoryModal(section.id); }}>
                        Ver Tabla
                    </button>
                    <button
                        style="padding: 6px 12px; font-size: 0.9rem; min-height: 36px;"
                        @click=${(e) => { e.stopPropagation(); navigate('detail', section.id); }}>
                        Tomar Asistencia
                    </button>
                </div>
            </div>
        </div>
    `;
};

// --- 2. Section Detail View ---
const sectionDetailTemplate = (section) => {
    if (!section) return html`<p>Sección no encontrada.</p>`;

    const students = DataManager.getStudents(section.id);

    // Determine the range of dates recorded.
    const attendanceRecords = DataManager.getAttendanceRecords(section.id);
    const recordedDates = Object.keys(attendanceRecords).sort();

    const today = new Date().toISOString().split('T')[0];

    const hasStartDate = !!section.startDate;

    let displayDates = [];

    if (hasStartDate) {
        // Use section-defined start date
        let startDate = section.startDate;
        let endDate;

        if (recordedDates.length > 0) {
            const firstRecorded = recordedDates[0];
            const lastRecorded = recordedDates[recordedDates.length - 1];

            // If no custom start date (should not happen here), use first recorded date
            if (!startDate) {
                startDate = firstRecorded;
            }

            // End date is the later of today or last recorded date
            endDate = today > lastRecorded ? today : lastRecorded;
        } else {
            // No attendance yet: default end to today
            endDate = today;
        }

        // Ensure startDate is not after endDate
        if (startDate > endDate) {
            startDate = endDate;
        }

        let businessDays = DataManager.getBusinessDays(startDate, endDate);

        // NEW: Filtrar días visibles según la configuración de la sección (1=Mon...5=Fri)
        const visibleWeekdays = (section.visibleWeekdays && section.visibleWeekdays.length)
            ? section.visibleWeekdays
            : [1, 2, 3, 4, 5];

        businessDays = businessDays.filter(dateStr => {
            const d = new Date(dateStr + 'T00:00:00Z');
            const dow = d.getUTCDay(); // 1 = Lunes, 2 = Martes, ..., 5 = Viernes
            return visibleWeekdays.includes(dow);
        });

        // Mostrar las fechas:
        // - Si showFullMap es false, solo el día actual.
        // - Si es true, todas las fechas hábiles calculadas.
        if (state.showFullMap) {
            displayDates = businessDays;
        } else {
            // Aseguramos que hoy esté disponible en el mapa aunque no haya registros previos.
            if (!businessDays.includes(today)) {
                displayDates = [today];
            } else {
                displayDates = [today];
            }
        }
    }

    return html`
        <header>
            <button class="secondary" @click=${() => navigate('sections')} style="margin-right: 10px; min-height: 44px; padding: 0 10px;">&lt;</button>
            <h1>${section.name}</h1>
        </header>
        <div class="main-content">

            <section class="card pastel-1" style="cursor: default; transform: none; transition: none; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);">
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <h2>Mapa de Asistencia</h2>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button
                                class="secondary"
                                @click=${() => { state.showFullMap = !state.showFullMap; renderApp(); }}
                                style="padding:6px 10px; font-size:0.8rem; min-height:36px;">
                                ${state.showFullMap ? 'Ver solo hoy' : 'Ver mapa completo'}
                            </button>
                            ${state.showFullMap ? html`
                                <button
                                    type="button"
                                    @click=${() => handleClearAttendance(section.id)}
                                    style="padding:6px 10px; font-size:0.8rem; background-color: var(--color-absent); color: #ffffff; border-radius: 8px;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <path d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.278l.84 11.045A2 2 0 0 0 8.11 20h7.78a2 2 0 0 0 1.992-1.955L18.722 7H19a1 1 0 1 0 0-2h-2.382l-.8 10.53a0.5 0.5 0 0 1-.497.47H8.278a0.5 0.5 0 0 1-.497-.47L6.98 6H9a1 1 0 0 0 .894-.553L10.382 5zM10 9a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1z"/>
                                    </svg>
                                </button>
                            ` : null}
                            <button
                                type="button"
                                class="secondary"
                                @click=${() => openModal('weekdaySelector', section)}
                                style="padding:6px 10px; font-size:0.8rem; min-height:36px;">
                                Días
                            </button>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <label for="startDate-${section.id}" style="font-size: 0.7rem;">Inicio Momento</label>
                                <input 
                                    id="startDate-${section.id}" 
                                    type="date" 
                                    .value=${section.startDate || ''} 
                                    @change=${(e) => handleStartDateChange(section.id, e)} 
                                    style="max-width: 140px; font-size: 0.7rem; padding: 4px 6px;">
                                <button
                                    type="button"
                                    class="secondary"
                                    @click=${handleInicioMomentoToggle}
                                    style="padding:4px 8px; font-size:0.7rem; min-height:32px;">
                                    ${state.inicioMomento}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                ${students.length === 0
                    ? html`<p style="color: var(--color-text-light);">La tabla aparecerá al añadir alumnos.</p>`
                    : (!hasStartDate
                        ? html`<p style="color: var(--color-text-light);">Selecciona la fecha de inicio del momento para ver el mapa de asistencia.</p>`
                        : (displayDates.length === 0
                            ? html`<p style="color: var(--color-text-light);">No hay días hábiles entre la fecha de inicio y hoy.</p>`
                            : attendanceGrid(section.id, students, displayDates, attendanceRecords)))}
            </section>

            ${state.showFullMap ? generalSummaryStats(students, attendanceRecords) : null}

            ${summaryStats(section.id, students, attendanceRecords)}

            <section class="card pastel-3" style="cursor: default; transform: none; transition: none; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08); font-size: 0.9rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2 style="font-size: 1rem;">Alumnos</h2>
                    <button @click=${toggleStudentListVisibility} class="secondary" style="padding: 8px 12px; font-size: 0.8rem;">
                        ${state.showStudentList ? 'Ocultar Lista' : 'Modificar Lista'}
                    </button>
                </div>

                ${state.showStudentList ? html`
                    <div style="border: 1px solid #ffd4c9; padding: 10px; border-radius: 8px; margin-bottom: 10px; background-color: var(--color-background); font-size: 0.85rem;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px;">
                            <button class="secondary" @click=${() => openModal('bulkAddStudents')} style="padding: 8px 12px; font-size: 0.8rem;">Importar Lista</button>
                            <button @click=${() => openModal('addStudent')} style="padding: 8px 12px; font-size: 0.8rem;">+ Añadir Alumno</button>
                        </div>
                        ${students.length === 0 
                            ? html`<p style="color: var(--color-text-light); text-align: center;">Añade alumnos para empezar a registrar la asistencia.</p>`
                            : html`<ul class="student-list" style="margin-top: 10px;">
                                ${students.map(s => studentItem(section.id, s))}
                            </ul>`}
                    </div>
                ` : html`
                    <p style="color: var(--color-text-light); margin-bottom: 10px;">Presiona "Modificar Lista" para ver y editar la lista de alumnos.</p>
                `}
            </section>
        </div>
    `;
};

const studentItem = (sectionId, student) => html`
    <li class="student-item">
        <div class="name-container" style="display:flex; align-items:center; gap:8px;">
            <div>
                <strong>${student.lastName}</strong>, ${student.firstName}
            </div>
            ${student.birthday ? html`
                ${isBirthday(student) ? html`
                    <img src="/birthday_${student.gender === 'F' ? 'pink' : 'blue'}.png" alt="Pastel" style="width:28px; height:28px;" title="¡Hoy es su cumpleaños!">
                ` : null}
            ` : null}
        </div>
        <button class="secondary" style="margin-left: 10px; padding: 0;" @click=${(e) => {e.stopPropagation(); openModal('editStudent', { ...student, sectionId });}}>✏️</button>
    </li>
`;

// --- Attendance Grid/Map ---
const attendanceGrid = (sectionId, students, dates, attendanceRecords) => html`
    <div class="attendance-grid">
        <table class="attendance-table">
            <thead>
                <tr>
                    <th style="width: 120px;">Alumno</th>
                    ${dates.map(date => html`<th class="date-header">${formatDateHeader(date)}</th>`)}
                </tr>
            </thead>
            <tbody>
                ${students.map(student => attendanceRow(sectionId, student, dates, attendanceRecords))}
            </tbody>
        </table>
    </div>
`;

const attendanceRow = (sectionId, student, dates, attendanceRecords) => html`
    <tr>
        <th style="display:flex; align-items:center; gap:8px;">
            <div>${student.lastName}, ${student.firstName}</div>
            ${student.birthday ? html`
                ${isBirthday(student) ? html`
                    <img src="/birthday_${student.gender === 'F' ? 'pink' : 'blue'}.png" alt="Pastel" style="width:20px; height:20px;" title="¡Hoy es su cumpleaños!">
                ` : null}
            ` : null}
        </th>
        ${dates.map(date => attendanceCell(sectionId, student.id, date, attendanceRecords))}
    </tr>
`;

const attendanceCell = (sectionId, studentId, date, attendanceRecords) => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;
    const isPast = date < today;

    // Status is 'P', 'A', 'L', or 'U' (Unmarked)
    const status = attendanceRecords[date] ? (attendanceRecords[date][studentId] || 'U') : 'U';

    let displayStatus = status; // Tracks the status used for CSS styling if not modified
    let cellContent = '';
    let handler; // Function to call on click

    if (isToday) {
        // Para el día actual: ciclo Asistente (P) -> Inasistente (A) -> Retardo (L) -> ...
        // El estado sin marcar (U) se muestra como Asistente (P) por defecto.
        const effectiveStatus = status === 'U' ? 'P' : status;

        if (effectiveStatus === 'P') {
            // Asistente
            displayStatus = 'P';
            cellContent = 'A';
        } else if (effectiveStatus === 'A') {
            // Inasistente
            displayStatus = 'A';
            cellContent = 'I';
        } else {
            // Retardo (L)
            displayStatus = 'L';
            cellContent = 'R';
        }

        // Ciclo para hoy: P -> A -> L -> P ...
        handler = () => {
            const current = status === 'U' ? 'P' : status;
            const cycle = ['P', 'A', 'L'];
            const idx = cycle.indexOf(current);
            const nextStatus = cycle[(idx + 1) % cycle.length];
            DataManager.setAttendanceStatus(sectionId, studentId, date, nextStatus);
            renderApp();
        };

    } else if (isPast) {
        // Handle past days: Display checkmark (✓) or X (×). Background neutral, colored symbol.
        if (status === 'P') {
            displayStatus = 'P';
            cellContent = '✓';
        } else if (status === 'A') {
            displayStatus = 'A';
            cellContent = '×';
        } else if (status === 'L') {
            displayStatus = 'L';
            cellContent = 'R'; // Retardo
        } else {
            // Unmarked past day
            displayStatus = 'U';
            cellContent = '';
        }
        
        // Use default cycle toggle for past dates (U->P->A->L->U)
        handler = () => {
            DataManager.toggleAttendance(sectionId, studentId, date);
            renderApp();
        };

    } else {
        // Future date: Use default toggle logic and display P/A/L (A/I/R) or empty
        if (status === 'L') {
            cellContent = 'R';
        } else if (status === 'A') {
            cellContent = 'I';
        } else if (status === 'P') {
            cellContent = 'A';
        } else {
            cellContent = '';
        }
        handler = () => {
            DataManager.toggleAttendance(sectionId, studentId, date);
            renderApp();
        };
    }

    // Determine CSS status
    const cssStatus = isToday && status === 'U' ? 'P' : displayStatus;
    
    // Add class for past days to handle styling differently
    const cellClass = `attendance-cell status-${cssStatus} ${isPast ? 'past-day' : ''}`;

    return html`
        <td>
            <div class=${cellClass} @click=${handler}>
                ${cellContent}
            </div>
        </td>
    `;
};

// --- Statistics ---
const summaryStats = (sectionId, students, attendanceRecords) => {
    if (students.length === 0) return html`<p>No hay datos para mostrar.</p>`;

    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords[today] || {};
    const lateTimes = DataManager.getLateTimes(sectionId);
    const todayLateTimes = lateTimes[today] || {};
    
    const stats = {
        M: { present: 0, absent: 0, late: 0 }, // Niños
        F: { present: 0, absent: 0, late: 0 }, // Niñas
        U: { present: 0, absent: 0, late: 0 }  // Otros/Desconocido
    };
    
    // Calculate statistics per gender based on TODAY's attendance
    students.forEach(student => {
        // Status is retrieved from records, defaulting to 'U' (Unmarked) if no record exists for today or for the student.
        const status = todayRecords[student.id] || 'U'; 
        
        // Ensure student.gender exists, defaulting to 'U'
        const genderKey = student.gender === 'M' ? 'M' : student.gender === 'F' ? 'F' : 'U';

        // P y U cuentan como asistencia; L cuenta como asistencia y además como retardo.
        if (status === 'P' || status === 'U') {
            stats[genderKey].present++;
        } else if (status === 'L') {
            stats[genderKey].present++;
            stats[genderKey].late++;
        } else if (status === 'A') {
            // A (Absent) es Inasistente.
            stats[genderKey].absent++;
        }
    });

    const totalPresentesNino = stats.M.present;
    const totalAusentesNino = stats.M.absent; // Inasistentes
    const totalRetardosNino = stats.M.late;
    const totalPresentesNina = stats.F.present;
    const totalAusentesNina = stats.F.absent; // Inasistentes
    const totalRetardosNina = stats.F.late;
    
    // We only display counts for M and F as per user request.

    return html`
        <div class="card stats-card pastel-2">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <h3 style="color: var(--color-primary); font-size: 0.95rem;">Asistencia de Hoy (${formatDateHeader(today)})</h3>
                <button
                    type="button"
                    style="padding:4px 10px; font-size:0.8rem; min-height:32px; background-color: var(--color-late); color:#ffffff; border:none; border-radius:999px;"
                    @click=${() => openLateModal(sectionId, today)}>
                    Retardos
                </button>
            </div>
            <table class="stats-table" style="width: 100%; text-align: left; font-size: 0.85rem;">
                <tbody>
                    <tr>
                        <td colspan="2" style="font-weight: bold; border-bottom: none; color: var(--color-primary); padding-top: 2px; padding-bottom: 2px;">Niños</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">Asistentes</td>
                        <td style="text-align: right; color: var(--color-present); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalPresentesNino}</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">Inasistentes</td>
                        <td style="text-align: right; color: var(--color-absent); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalAusentesNino}</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">
                            <span>Retardos</span>
                        </td>
                        <td style="text-align: right; color: var(--color-late); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalRetardosNino}</td>
                    </tr>
                    <tr style="height: 6px;"><td colspan="2" style="border-bottom: 1px solid #eee; padding: 0;"></td></tr>
                    <tr>
                        <td colspan="2" style="font-weight: bold; border-bottom: none; color: var(--color-primary); padding-top: 2px; padding-bottom: 2px;">Niñas</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">Asistentes</td>
                        <td style="text-align: right; color: var(--color-present); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalPresentesNina}</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">Inasistentes</td>
                        <td style="text-align: right; color: var(--color-absent); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalAusentesNina}</td>
                    </tr>
                    <tr>
                        <td style="padding-left: 12px; padding-top: 2px; padding-bottom: 2px;">
                            Retardos
                        </td>
                        <td style="text-align: right; color: var(--color-late); font-weight: bold; font-size: 1rem; padding-top: 2px; padding-bottom: 2px;">${totalRetardosNina}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
};

// NEW: General attendance/absence summary across all records
const generalSummaryStats = (students, attendanceRecords) => {
    if (students.length === 0) return html``;

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    // Recorremos todos los días registrados
    Object.keys(attendanceRecords).forEach(dateStr => {
        const dayRecords = attendanceRecords[dateStr] || {};
        students.forEach(student => {
            const status = dayRecords[student.id] || 'U';
            // P y U como asistencia, L como asistencia y retardo, A como inasistencia; ignoramos U para totales marcados de A/L
            if (status === 'P' || status === 'U') {
                totalPresent++;
            } else if (status === 'L') {
                totalPresent++;
                totalLate++;
            } else if (status === 'A') {
                totalAbsent++;
            }
        });
    });

    const totalMarked = totalPresent + totalAbsent;
    let attendancePercent = '--';
    let absencePercent = '--';

    if (totalMarked > 0) {
        attendancePercent = ((totalPresent / totalMarked) * 100).toFixed(2);
        absencePercent = (100 - parseFloat(attendancePercent)).toFixed(2);
    }

    return html`
        <div class="card stats-card pastel-4" style="margin-top:10px;">
            <h3 style="margin-bottom: 8px; color: var(--color-primary);">Resumen General de Asistencia</h3>
            <div class="attendance-summary">
                <div class="attendance-box attendance-box-present">
                    <span>Asistencia</span>
                    <span>${attendancePercent === '--' ? '--' : attendancePercent + '%'}</span>
                </div>
                <div class="attendance-box attendance-box-absent">
                    <span>Inasistencia</span>
                    <span>${absencePercent === '--' ? '--' : absencePercent + '%'}</span>
                </div>
            </div>
            <p style="margin-top:6px; font-size:0.8rem; color:var(--color-text-light);">
                Cálculo basado en todos los registros marcados de la sección.
            </p>
            <p style="margin-top:4px; font-size:0.8rem; color:var(--color-late);">
                Retardos totales: <strong>${totalLate}</strong>
            </p>
        </div>
    `;
};

// --- Modals (Forms) ---
const modalTemplate = () => {
    if (!state.modal) return null;

    let content;
    let title;
    let submitHandler;

    // Determine if we should show birthday field based on subject name "orientación vocacional"
    const currentSectionForModal = state.selectedSectionId ? DataManager.getSection(state.selectedSectionId) : null;
    const editingSectionForModal = state.editingStudent ? DataManager.getSection(state.editingStudent.sectionId) : null;
    const subjectsList = DataManager.getSubjects();

    function sectionIsVocational(section) {
        if (!section) return false;
        const subj = subjectsList.find(s => s.id === section.subjectId);
        return subj && typeof subj.name === 'string' && subj.name.trim().toLowerCase() === 'orientación vocacional';
    }

    const showBirthdayWhenAdding = sectionIsVocational(currentSectionForModal);
    const showBirthdayWhenEditing = sectionIsVocational(editingSectionForModal);

    if (state.modal === 'bulkAddStudents') {
        title = 'Importar Lista de Alumnos';
        submitHandler = handleBulkAddStudents;
        content = html`
            <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--color-text-light);">Introduce la lista de alumnos, un alumno por línea. Intenta usar el formato: <strong>Apellido(s) Nombre(s)</strong> (separado por espacio o coma).</p>
            <div class="form-group">
                <label for="studentListTextarea">Lista de Alumnos:</label>
                <textarea id="studentListTextarea" name="studentListTextarea" rows="8" required placeholder="Ejemplo:&#10;García Pérez, Ana María&#10;Rodríguez López Pedro"></textarea>
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Importar</button>
            </div>
        `;
    } else if (state.modal === 'addSubject') {
        title = 'Añadir Nueva Materia';
        submitHandler = handleAddSubject;
        content = html`
            <div class="form-group">
                <label for="subjectName">Nombre de la Materia:</label>
                <input type="text" id="subjectName" name="subjectName" required placeholder="Ej: Matemáticas">
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Guardar</button>
            </div>
        `;
    } else if (state.modal === 'editSubject') {
        const subject = state.editingSubject;
        if (!subject) return null;
        title = `Editar Materia`;
        submitHandler = handleEditSubject;
        content = html`
            <div class="form-group">
                <label for="editSubjectName">Nombre de la Materia:</label>
                <input type="text" id="editSubjectName" name="editSubjectName" .value=${subject.name} required>
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" style="background-color: var(--color-absent); color: white; border: none; min-height: 44px; padding: 10px;" @click=${handleDeleteSubject}>Eliminar Materia</button>
                <div style="flex-grow: 1;"></div>
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Guardar</button>
            </div>
        `;
    } else if (state.modal === 'addSection') {
        const subjects = DataManager.getSubjects();
        title = 'Añadir Nueva Sección';
        submitHandler = handleAddSection;
        content = html`
            <div class="form-group">
                <label for="sectionName">Nombre de la Sección:</label>
                <input type="text" id="sectionName" name="sectionName" required placeholder="Ej: 1° B Media">
            </div>
            <div class="form-group">
                <label for="sectionSubject">Materia:</label>
                <select id="sectionSubject" name="sectionSubject" required>
                    ${subjects && subjects.length ? subjects.map(s => html`
                        <option value=${s.id}>${s.name}</option>
                    `) : html`<option value="" disabled selected>No hay materias, crea una primero.</option>`}
                </select>
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit" ?disabled=${!subjects || !subjects.length}>Guardar</button>
            </div>
        `;
    } else if (state.modal === 'editSection') {
        const section = state.editingSection;
        if (!section) return null;
        const subjects = DataManager.getSubjects();
        title = `Editar Sección: ${section.name}`;
        submitHandler = handleEditSection;
        content = html`
            <div class="form-group">
                <label for="newSectionName">Nuevo Nombre:</label>
                <input type="text" id="newSectionName" name="newSectionName" .value=${section.name} required>
            </div>
            <div class="form-group">
                <label for="editSectionSubject">Materia:</label>
                <select id="editSectionSubject" name="editSectionSubject" required>
                    ${subjects && subjects.length ? subjects.map(s => html`
                        <option value=${s.id} ?selected=${section.subjectId === s.id}>${s.name}</option>
                    `) : html`<option value="" disabled selected>No hay materias</option>`}
                </select>
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" style="background-color: var(--color-absent); color: white; border: none; min-height: 44px; padding: 10px;" @click=${handleDeleteSection}>Eliminar Sección</button>
                <div style="flex-grow: 1;"></div>
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Guardar</button>
            </div>
        `;

    } else if (state.modal === 'weekdaySelector') {
        const section = state.editingSection;
        if (!section) return null;
        title = `Seleccionar días visibles`;
        submitHandler = (e) => e.preventDefault();
        const visibleWeekdays = (section.visibleWeekdays && section.visibleWeekdays.length)
            ? section.visibleWeekdays
            : [1, 2, 3, 4, 5];

        content = html`
            <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--color-text-light);">
                Elige qué días de la semana quieres ver en el mapa de asistencia.
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${[1, 2, 3, 4, 5].map(dow => {
                    const labels = {1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes'};
                    const checked = visibleWeekdays.includes(dow);
                    return html`
                        <label style="display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid #ffd4c9; background-color:${checked ? '#ffe4e4' : '#fffdf8'}; font-size:0.9rem;">
                            <input
                                type="checkbox"
                                .checked=${checked}
                                @change=${() => handleWeekdayToggle(section.id, dow)}
                                style="margin:0;">
                            <span>${labels[dow]}</span>
                        </label>
                    `;
                })}
            </div>
            <div class="form-actions" style="margin-top:16px;">
                <button class="secondary" type="button" @click=${closeModal}>Cerrar</button>
            </div>
        `;
    } else if (state.modal === 'addStudent') {
        title = 'Añadir Nuevo Alumno';
        submitHandler = handleAddStudent;
        content = html`
            <div class="form-group">
                <label for="studentLastName">Apellido(s):</label>
                <input type="text" id="studentLastName" name="studentLastName" required placeholder="Pérez">
            </div>
            <div class="form-group">
                <label for="studentFirstName">Nombre(s):</label>
                <input type="text" id="studentFirstName" name="studentFirstName" required placeholder="Juan">
            </div>
            <div class="form-group">
                <label>Género:</label>
                <div style="display: flex; gap: 15px;">
                    <label><input type="radio" name="studentGender" value="M" checked required> Niño</label>
                    <label><input type="radio" name="studentGender" value="F"> Niña</label>
                </div>
            </div>
            ${showBirthdayWhenAdding ? html`
                <div class="form-group">
                    <label for="studentBirthday">Fecha de nacimiento:</label>
                    <input type="date" id="studentBirthday" name="studentBirthday" placeholder="YYYY-MM-DD">
                </div>
            ` : ''}
            <div class="form-actions">
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Añadir</button>
            </div>
        `;
    } else if (state.modal === 'editStudent') {
        const student = state.editingStudent;
        if (!student) return null;
        title = `Editar Alumno`;
        submitHandler = handleEditStudent;
        content = html`
            <div class="form-group">
                <label for="editLastName">Apellido(s):</label>
                <input type="text" id="editLastName" name="editLastName" .value=${student.lastName} required>
            </div>
            <div class="form-group">
                <label for="editFirstName">Nombre(s):</label>
                <input type="text" id="editFirstName" name="editFirstName" .value=${student.firstName} required>
            </div>
            <div class="form-group">
                <label>Género:</label>
                <div style="display: flex; gap: 15px;">
                    <label><input type="radio" name="editGender" value="M" ?checked=${student.gender === 'M'} required> Niño</label>
                    <label><input type="radio" name="editGender" value="F" ?checked=${student.gender === 'F'}> Niña</label>
                    <label><input type="radio" name="editGender" value="U" ?checked=${student.gender === 'U' || !student.gender}> Otro/Desconocido</label>
                </div>
            </div>
            ${showBirthdayWhenEditing ? html`
                <div class="form-group">
                    <label for="editBirthday">Fecha de nacimiento:</label>
                    <input type="date" id="editBirthday" name="editBirthday" .value=${student.birthday || ''}>
                </div>
            ` : ''}
            <div class="form-actions">
                <button class="secondary" type="button" style="background-color: var(--color-absent); color: white; border: none; min-height: 44px; padding: 10px;" @click=${handleDeleteStudent}>Eliminar Alumno</button>
                <div style="flex-grow: 1;"></div>
                <button class="secondary" type="button" @click=${closeModal}>Cancelar</button>
                <button type="submit">Guardar</button>
            </div>
        `;
    } else if (state.modal === 'history') {
        const sectionId = state.history.sectionId;
        const section = sectionId ? DataManager.getSection(sectionId) : null;
        title = section ? `Historial de Asistencia - ${section.name}` : 'Historial de Asistencia';
        submitHandler = (e) => e.preventDefault(); // No submit needed

        const historyTable = sectionId ? historyTableTemplate(sectionId, state.history.studentFilter) : html`
            <p style="color: var(--color-text-light); margin-top:10px;">No se encontró la sección.</p>
        `;

        content = html`
            <div class="form-group" style="margin-bottom: 8px;">
                <label for="historyStudentFilter" style="display:block; margin-bottom:4px; font-size:0.85rem;">
                    Filtrar por alumno (nombre o apellido):
                </label>
                <input
                    id="historyStudentFilter"
                    type="text"
                    placeholder="Ej: Pérez o Ana"
                    .value=${state.history.studentFilter}
                    @input=${(e) => handleHistoryStudentFilterChange(e.target.value)}
                    style="font-size:0.9rem;">
                <p style="margin-top:4px; font-size:0.75rem; color: var(--color-text-light);">
                    Si introduces un nombre/apellido, se mostrará el historial de ese alumno.
                </p>
            </div>

            <div class="form-group" style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:6px;">Mostrar:</label>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    <button type="button"
                        class="secondary"
                        style="padding:6px 10px; font-size:0.8rem; ${state.history.filter === '7' ? 'background-color: var(--color-primary); color: white;' : ''}"
                        @click=${() => setHistoryFilter('7')}>
                        Últimos 7 días
                    </button>
                    <button type="button"
                        class="secondary"
                        style="padding:6px 10px; font-size:0.8rem; ${state.history.filter === '14' ? 'background-color: var(--color-primary); color: white;' : ''}"
                        @click=${() => setHistoryFilter('14')}>
                        Últimos 14 días
                    </button>
                    <button type="button"
                        class="secondary"
                        style="padding:6px 10px; font-size:0.8rem; ${state.history.filter === '30' ? 'background-color: var(--color-primary); color: white;' : ''}"
                        @click=${() => setHistoryFilter('30')}>
                        Últimos 30 días
                    </button>
                    <button type="button"
                        class="secondary"
                        style="padding:6px 10px; font-size:0.8rem; ${state.history.filter === 'custom' ? 'background-color: var(--color-primary); color: white;' : ''}"
                        @click=${() => setHistoryFilter('custom')}>
                        Rango personalizado
                    </button>
                </div>
            </div>

            ${state.history.filter === 'custom' ? html`
                <div class="form-group" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
                    <div style="flex:1; min-width:120px;">
                        <label for="historyStart" style="font-size:0.8rem;">Desde:</label>
                        <input
                            id="historyStart"
                            type="date"
                            .value=${state.history.customStart}
                            @change=${(e) => handleHistoryCustomDateChange('start', e.target.value)}
                            style="font-size:0.8rem;">
                    </div>
                    <div style="flex:1; min-width:120px;">
                        <label for="historyEnd" style="font-size:0.8rem;">Hasta:</label>
                        <input
                            id="historyEnd"
                            type="date"
                            .value=${state.history.customEnd}
                            @change=${(e) => handleHistoryCustomDateChange('end', e.target.value)}
                            style="font-size:0.8rem;">
                    </div>
                </div>
            ` : null}

            ${historyTable}

            <div class="form-actions" style="margin-top:16px;">
                <button class="secondary" type="button" @click=${() => exportHistoryPDF()}>Exportar PDF</button>
                <div style="flex:1;"></div>
                <button class="secondary" type="button" @click=${closeModal}>Cerrar</button>
            </div>
        `;
    } else if (state.modal === 'lateList') {
        const { sectionId, date } = state.lateContext || {};
        const section = sectionId ? DataManager.getSection(sectionId) : null;
        const students = sectionId ? DataManager.getStudents(sectionId) : [];
        const lateTimes = sectionId ? DataManager.getLateTimes(sectionId) : {};
        const todayLateTimes = (lateTimes && date && lateTimes[date]) ? lateTimes[date] : {};

        title = section
            ? `Retardos del día ${formatDateHeader(date)} - ${section.name}`
            : 'Retardos del día';

        submitHandler = (e) => e.preventDefault();

        const lateEntries = students
            .filter(s => todayLateTimes[s.id])
            .map(s => ({
                name: `${s.lastName}, ${s.firstName}`,
                time: todayLateTimes[s.id]
            }))
            .sort((a, b) => a.time.localeCompare(b.time));

        content = html`
            ${lateEntries.length === 0 ? html`
                <p style="margin-top:10px; font-size:0.9rem; color:var(--color-text-light);">
                    No hay alumnos registrados con retardo para este día.
                </p>
            ` : html`
                <p style="margin-top:6px; font-size:0.85rem; color:var(--color-text-light);">
                    Lista de alumnos que llegaron tarde y la hora registrada al marcar el retardo.
                </p>
                <div style="max-height:260px; overflow:auto; margin-top:8px; border:1px solid #ffd4c9; border-radius:8px;">
                    <table class="stats-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr>
                                <th style="padding:8px 10px; text-align:left;">Alumno</th>
                                <th style="padding:8px 10px; text-align:left;">Hora</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lateEntries.map(entry => html`
                                <tr>
                                    <td style="padding:6px 10px;">${entry.name}</td>
                                    <td style="padding:6px 10px; font-weight:bold; color:var(--color-late);">${entry.time}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
            `}
            <div class="form-actions" style="margin-top:16px;">
                <button class="secondary" type="button" @click=${closeModal}>Cerrar</button>
            </div>
        `;
    }

    return html`
        <div class="modal-overlay active" @click=${(e) => e.target.classList.contains('modal-overlay') && closeModal()}>
            <form class="modal" @submit=${submitHandler}>
                <h2>${title}</h2>
                ${content}
            </form>
        </div>
    `;
};

// --- NEW: History helpers & handlers ---

function setHistoryFilter(filter) {
    state.history.filter = filter;
    renderApp();
}

function handleHistoryCustomDateChange(field, value) {
    if (field === 'start') {
        state.history.customStart = value || '';
    } else if (field === 'end') {
        state.history.customEnd = value || '';
    }
    renderApp();
}

function handleHistoryStudentFilterChange(value) {
    state.history.studentFilter = value;
    renderApp();
}

function historyTableTemplate(sectionId, studentFilterText) {
    const students = DataManager.getStudents(sectionId);
    const attendanceRecords = DataManager.getAttendanceRecords(sectionId);
    const allDates = Object.keys(attendanceRecords).sort(); // ascending

    if (allDates.length === 0) {
        return html`<p style="color: var(--color-text-light); margin-top:10px;">Aún no hay registros de asistencia.</p>`;
    }

    const filteredDates = getFilteredHistoryDates(allDates);
    if (filteredDates.length === 0) {
        return html`<p style="color: var(--color-text-light); margin-top:10px;">No hay registros en el período seleccionado.</p>`;
    }

    const trimmedFilter = (studentFilterText || '').trim().toLowerCase();

    // Si NO hay filtro de alumno, mostrar resumen general por día (como antes)
    if (!trimmedFilter) {
        // Build rows with counts
        const rows = filteredDates.map(dateStr => {
            const dayRecords = attendanceRecords[dateStr] || {};
            let present = 0;
            let absent = 0;
            let late = 0;

            students.forEach(student => {
                const status = dayRecords[student.id] || 'U';
                // Ahora contamos 'U' (no marcado) como asistencia inicial,
                // 'L' como retardo (también cuenta como presente), y 'A' como inasistencia.
                if (status === 'P' || status === 'U') present++;
                else if (status === 'L') { present++; late++; }
                else if (status === 'A') absent++;
            });

            return { dateStr, present, absent, late };
        });

        return html`
            <div style="max-height:300px; overflow:auto; margin-top:8px; border:1px solid #ffd4c9; border-radius:8px;">
                <table class="stats-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead>
                        <tr>
                            <th style="padding:8px 10px; text-align:left;">Fecha</th>
                            <th style="padding:8px 10px; text-align:right; color:var(--color-present);">Asistentes</th>
                            <th style="padding:8px 10px; text-align:right; color:var(--color-absent);">Inasistentes</th>
                            <th style="padding:8px 10px; text-align:right; color:var(--color-late);">Retardos</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => html`
                            <tr>
                                <td style="padding:6px 10px;">${formatDateHeader(r.dateStr)}</td>
                                <td style="padding:6px 10px; text-align:right; font-weight:bold;">${r.present}</td>
                                <td style="padding:6px 10px; text-align:right; font-weight:bold;">${r.absent}</td>
                                <td style="padding:6px 10px; text-align:right; font-weight:bold;">${r.late}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Si HAY filtro de alumno, mostramos historial para el primer alumno que coincida
    const matchingStudents = students.filter(s => {
        const fullName = `${s.lastName} ${s.firstName}`.toLowerCase();
        const invertedName = `${s.firstName} ${s.lastName}`.toLowerCase();
        return fullName.includes(trimmedFilter) || invertedName.includes(trimmedFilter);
    });

    if (matchingStudents.length === 0) {
        return html`
            <p style="color: var(--color-text-light); margin-top:10px;">
                No se encontró ningún alumno con ese nombre o apellido en esta sección.
            </p>
        `;
    }

    const student = matchingStudents[0];

    const rows = filteredDates.map(dateStr => {
        const dayRecords = attendanceRecords[dateStr] || {};
        const status = dayRecords[student.id] || 'U'; // P, A, L, U

        let label = 'Sin registro';
        let color = 'var(--color-text-light)';

        if (status === 'P' || status === 'U') {
            label = 'Asistió';
            color = 'var(--color-present)';
        } else if (status === 'A') {
            label = 'Inasistente';
            color = 'var(--color-absent)';
        } else if (status === 'L') {
            label = 'Retardo';
            color = 'var(--color-late)';
        }

        return { dateStr, label, color };
    });

    return html`
        <p style="margin-top:6px; font-size:0.85rem;">
            Mostrando historial de: <strong>${student.lastName}, ${student.firstName}</strong>
        </p>
        <div style="max-height:300px; overflow:auto; margin-top:4px; border:1px solid #ffd4c9; border-radius:8px;">
            <table class="stats-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr>
                        <th style="padding:8px 10px; text-align:left;">Fecha</th>
                        <th style="padding:8px 10px; text-align:left;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => html`
                        <tr>
                            <td style="padding:6px 10px;">${formatDateHeader(r.dateStr)}</td>
                            <td style="padding:6px 10px; font-weight:bold; color:${r.color};">${r.label}</td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
}

function getFilteredHistoryDates(allDates) {
    const { filter, customStart, customEnd } = state.history;
    const todayStr = new Date().toISOString().split('T')[0];

    if (filter === 'custom') {
        if (!customStart || !customEnd) return [];
        const start = customStart <= customEnd ? customStart : customEnd;
        const end = customEnd >= customStart ? customEnd : customStart;
        return allDates.filter(d => d >= start && d <= end);
    }

    const days = parseInt(filter, 10);
    if (isNaN(days)) return allDates;

    const today = new Date(todayStr + 'T00:00:00Z');
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const startStr = startDate.toISOString().split('T')[0];

    return allDates.filter(d => d >= startStr && d <= todayStr);
}

/* --- PDF export for history --- */

/**
 * Exports the currently selected history view (state.history) for section to a simple PDF.
 * Builds human-readable rows depending on whether a student filter is active.
 */
function exportHistoryPDF() {
    const sectionId = state.history.sectionId;
    if (!sectionId) {
        alert('No hay sección seleccionada para exportar.');
        return;
    }
    const section = DataManager.getSection(sectionId);
    if (!section) {
        alert('Sección no encontrada.');
        return;
    }

    const students = DataManager.getStudents(sectionId);
    const attendanceRecords = DataManager.getAttendanceRecords(sectionId);
    const allDates = Object.keys(attendanceRecords).sort();
    const filteredDates = getFilteredHistoryDates(allDates);
    if (filteredDates.length === 0) {
        alert('No hay registros en el período seleccionado para exportar.');
        return;
    }

    const trimmedFilter = (state.history.studentFilter || '').trim().toLowerCase();

    const doc = new jsPDF({
        unit: 'pt',
        format: 'a4'
    });

    const margin = 40;
    let y = 40;
    doc.setFontSize(14);
    doc.text(`Historial de Asistencia - ${section.name}`, margin, y);
    y += 20;
    doc.setFontSize(10);
    doc.text(`Período: ${filteredDates[0]} - ${filteredDates[filteredDates.length - 1]}`, margin, y);
    y += 18;

    if (!trimmedFilter) {
        // Summary per date
        doc.setFontSize(11);
        doc.text('Fecha               Asistentes   Inasistentes   Retardos', margin, y);
        y += 14;
        doc.setFontSize(10);
        filteredDates.forEach(d => {
            const dayRecords = attendanceRecords[d] || {};
            let present = 0, absent = 0, late = 0;
            students.forEach(s => {
                const status = dayRecords[s.id] || 'U';
                if (status === 'P' || status === 'U') present++;
                else if (status === 'L') { present++; late++; }
                else if (status === 'A') absent++;
            });
            const line = `${d}     ${String(present).padStart(8,' ')}     ${String(absent).padStart(8,' ')}     ${String(late).padStart(8,' ')}`;
            if (y > 740) { doc.addPage(); y = 40; }
            doc.text(line, margin, y);
            y += 12;
        });
    } else {
        // Find matching student
        const matchingStudents = students.filter(s => {
            const fullName = `${s.lastName} ${s.firstName}`.toLowerCase();
            const invertedName = `${s.firstName} ${s.lastName}`.toLowerCase();
            return fullName.includes(trimmedFilter) || invertedName.includes(trimmedFilter);
        });
        if (matchingStudents.length === 0) {
            alert('No se encontró ningún alumno con ese filtro.');
            return;
        }
        const student = matchingStudents[0];
        doc.setFontSize(11);
        doc.text(`Alumno: ${student.lastName}, ${student.firstName}`, margin, y);
        y += 16;
        doc.setFontSize(10);
        doc.text('Fecha               Estado', margin, y);
        y += 14;
        filteredDates.forEach(d => {
            const dayRecords = attendanceRecords[d] || {};
            const status = dayRecords[student.id] || 'U';
            let label = 'Sin registro';
            if (status === 'P' || status === 'U') label = 'Asistió';
            else if (status === 'A') label = 'Inasistente';
            else if (status === 'L') label = 'Retardo';
            const line = `${d}     ${label}`;
            if (y > 740) { doc.addPage(); y = 40; }
            doc.text(line, margin, y);
            y += 12;
        });
    }

    doc.save(`historial_${section.name.replace(/\s+/g,'_')}.pdf`);
}

/* --- Handlers --- */

function handleAddSection(e) {
    e.preventDefault();
    const nameInput = e.target.querySelector('#sectionName');
    const subjectSelect = e.target.querySelector('#sectionSubject');
    const name = nameInput.value.trim();
    const subjectId = subjectSelect ? subjectSelect.value : null;
    if (name && subjectId) {
        DataManager.addSection(name, subjectId);
        closeModal();
        renderApp();
    }
}

function handleEditSection(e) {
    e.preventDefault();
    const nameInput = e.target.querySelector('#newSectionName');
    const subjectSelect = e.target.querySelector('#editSectionSubject');
    const newName = nameInput.value.trim();
    const newSubjectId = subjectSelect ? subjectSelect.value : null;
    if (newName && state.editingSection && newSubjectId) {
        DataManager.updateSectionName(state.editingSection.id, newName, newSubjectId);
        closeModal();
        renderApp();
    }
}

function handleDeleteSection() {
    if (confirm(`¿Estás seguro que deseas eliminar la sección "${state.editingSection.name}"? Esta acción es irreversible.`)) {
        const deletedId = state.editingSection.id;
        DataManager.deleteSection(deletedId);

        // If we were viewing this section, navigate back to sections list
        if (state.selectedSectionId === deletedId) {
            navigate('sections');
        } else {
            closeModal();
            renderApp();
        }
    }
}

function handleAddStudent(e) {
    e.preventDefault();
    const sectionId = state.selectedSectionId;
    const lastName = e.target.querySelector('#studentLastName').value.trim();
    const firstName = e.target.querySelector('#studentFirstName').value.trim();
    const genderInput = e.target.querySelector('input[name="studentGender"]:checked');
    const gender = genderInput ? genderInput.value : 'M';
    const birthdayInput = e.target.querySelector('#studentBirthday');
    const birthday = birthdayInput ? (birthdayInput.value || null) : null;

    if (sectionId && lastName && firstName) {
        DataManager.addStudent(sectionId, firstName, lastName, gender, birthday);
        closeModal();
        renderApp();
    } else {
        alert("Por favor, completa nombre y apellido.");
    }
}

function handleAddSubject(e) {
    e.preventDefault();
    const nameInput = e.target.querySelector('#subjectName');
    const name = nameInput.value.trim();
    if (name) {
        DataManager.addSubject(name);
        closeModal();
        renderApp();
    }
}

function handleEditSubject(e) {
    e.preventDefault();
    const subject = state.editingSubject;
    if (!subject) return;
    const nameInput = e.target.querySelector('#editSubjectName');
    const newName = nameInput.value.trim();
    if (newName) {
        DataManager.updateSubjectName(subject.id, newName);
        closeModal();
        renderApp();
    }
}

function handleDeleteSubject() {
    const subject = state.editingSubject;
    if (!subject) return;
    if (confirm(`¿Estás seguro que deseas eliminar la materia "${subject.name}"? Se eliminarán también todas sus secciones.`)) {
        DataManager.deleteSubject(subject.id);
        closeModal();
        renderApp();
    }
}

function handleEditStudent(e) {
    e.preventDefault();
    const sectionId = state.editingStudent.sectionId;
    const studentId = state.editingStudent.id;
    const lastName = e.target.querySelector('#editLastName').value.trim();
    const firstName = e.target.querySelector('#editFirstName').value.trim();
    const genderInput = e.target.querySelector('input[name="editGender"]:checked');
    const gender = genderInput ? genderInput.value : 'U';
    const birthdayInput = e.target.querySelector('#editBirthday');
    const birthday = birthdayInput ? (birthdayInput.value || null) : null;

    if (sectionId && studentId && lastName && firstName) {
        DataManager.updateStudent(sectionId, studentId, firstName, lastName, gender, birthday);
        closeModal();
        renderApp();
    } else {
        alert("Por favor, completa nombre y apellido.");
    }
}

function handleDeleteStudent() {
    if (confirm(`Seguro que quieres eliminar a ${state.editingStudent.firstName} ${state.editingStudent.lastName}? Se borrarán todos sus registros de asistencia.`)) {
        DataManager.deleteStudent(state.editingStudent.sectionId, state.editingStudent.id);
        closeModal();
        renderApp();
    }
}

function handleBulkAddStudents(e) {
    e.preventDefault();
    const sectionId = state.selectedSectionId;
    const studentListTextarea = e.target.querySelector('#studentListTextarea');
    const text = studentListTextarea.value.trim();

    if (!sectionId || !text) {
        alert("Por favor, introduce una lista de alumnos.");
        return;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let studentsAdded = 0;

    lines.forEach(line => {
        let lastName = '';
        let firstName = '';

        if (line.includes(',')) {
            // Format: Last Name(s), First Name(s)
            const parts = line.split(',', 2).map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length === 2) {
                lastName = parts[0];
                firstName = parts[1];
            }
        } else {
            // Assume format: Last Name(s) First Name(s)
            const parts = line.split(/\s+/).filter(p => p.length > 0);
            
            if (parts.length >= 2) {
                // Split roughly in half, assuming the first half is the surname(s) for sorting
                const mid = Math.ceil(parts.length / 2);
                lastName = parts.slice(0, mid).join(' ');
                firstName = parts.slice(mid).join(' ');
            }
        }
        
        if (lastName && firstName) {
            DataManager.addStudent(sectionId, firstName, lastName);
            studentsAdded++;
        }
    });

    if (studentsAdded === 0) {
        alert("No se pudo añadir ningún alumno. Asegúrate de que cada línea contenga al menos dos palabras (nombre y apellido).");
    }
    
    closeModal();
    renderApp();
}

function handleStartDateChange(sectionId, event) {
    const value = event.target.value;
    DataManager.setSectionStartDate(sectionId, value || null);
    renderApp();
}

// NEW: alternar el momento de inicio entre I, II y III
function handleInicioMomentoToggle() {
    const order = ['I', 'II', 'III'];
    const currentIndex = order.indexOf(state.inicioMomento);
    const nextIndex = (currentIndex + 1) % order.length;
    state.inicioMomento = order[nextIndex];
    renderApp();
}

// NEW: Manejar cambios en los días de la semana visibles
function handleWeekdayToggle(sectionId, weekday) {
    const section = DataManager.getSection(sectionId);
    if (!section) return;

    const current = (section.visibleWeekdays && section.visibleWeekdays.length)
        ? [...section.visibleWeekdays]
        : [1, 2, 3, 4, 5];

    const idx = current.indexOf(weekday);
    if (idx >= 0) {
        current.splice(idx, 1);
    } else {
        current.push(weekday);
    }

    DataManager.setSectionVisibleWeekdays(sectionId, current);
    renderApp();
}

function handleClearAttendance(sectionId) {
    if (confirm("¿Quieres borrar todas las asistencias registradas de esta sección?")) {
        DataManager.clearAttendance(sectionId);
        renderApp();
    }
}

// Abrir modal con lista de retardos para una sección y fecha dadas
function openLateModal(sectionId, date) {
    state.lateContext = {
        sectionId,
        date
    };
    state.modal = 'lateList';
    renderApp();
}

 // --- Helper Functions ---

/**
 * Returns true if the given student has a birthday equal to today's date (ignores year),
 * and their birthday field is in YYYY-MM-DD format.
 */
function isBirthday(student) {
    if (!student || !student.birthday) return false;
    try {
        const today = new Date().toISOString().split('T')[0];
        const [, monthDay] = today.split('-').slice(1).join('-').split('-', 2); // fallback not used
        const todayMMDD = today.slice(5); // MM-DD
        const b = student.birthday;
        // Accept full YYYY-MM-DD; compare MM-DD
        if (b.length >= 5) {
            const bMMDD = b.slice(5);
            return bMMDD === todayMMDD;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Play birthday song and mark that we've played it for this section for today's date.
 * Only plays once per section per day.
 */
function checkBirthdayAlerts() {
    // If we're not viewing a section detail, nothing to do.
    if (state.currentView !== 'detail' || !state.selectedSectionId) return;

    const section = DataManager.getSection(state.selectedSectionId);
    if (!section) return;

    const students = DataManager.getStudents(section.id) || [];
    const birthdaysToday = students.filter(s => isBirthday(s));

    if (!birthdaysToday.length) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const playedDateForSection = state.birthdayAlarmPlayed[state.selectedSectionId];

    if (playedDateForSection === todayStr) {
        // Already handled today for this section
        return;
    }

    // Do not play audio; simply mark as handled so the alert doesn't repeat.
    state.birthdayAlarmPlayed[state.selectedSectionId] = todayStr;

    // Optional: log for debugging
    console.log(`Birthday(s) detected in section ${section.name} — marked as handled for ${todayStr}.`);
}

function formatDateHeader(dateStr) {
    // Input: YYYY-MM-DD
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

// --- Main Render Function ---
function renderApp() {
    let mainContent;

    if (state.currentView === 'sections') {
        const sections = DataManager.getSections();
        const subjects = DataManager.getSubjects();
        mainContent = sectionListTemplate(subjects, sections);
    } else if (state.currentView === 'detail' && state.selectedSectionId) {
        const section = DataManager.getSection(state.selectedSectionId);
        mainContent = sectionDetailTemplate(section);
    } else {
        // Fallback
        navigate('sections');
        return;
    }

    const appHtml = html`
        ${mainContent}
        ${modalTemplate()}
    `;

    render(appHtml, APP_CONTAINER);

    // After rendering UI, check and trigger birthday alerts if applicable.
    // This will attempt to play the song once per section per day.
    checkBirthdayAlerts();
}

// Initialize application
window.onload = renderApp;