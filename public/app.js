// API Base URL - uses relative path which works for both localhost and deployed
// When served by Express, static files and API are on the same origin
// This works automatically on both localhost:3000 and Render.com deployments
const API_BASE_URL = '/api';

// DOM Elements
const notesGrid = document.getElementById('notesGrid');
const emptyState = document.getElementById('emptyState');
const addNoteBtn = document.getElementById('addNoteBtn');
const categoryFilter = document.getElementById('categoryFilter');
const noteModal = document.getElementById('noteModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const noteForm = document.getElementById('noteForm');
const modalTitle = document.getElementById('modalTitle');
const isReminderCheckbox = document.getElementById('isReminder');
const reminderDateGroup = document.getElementById('reminderDateGroup');

// State
let notes = [];
let currentFilter = 'all';
let editingNoteId = null;
let shownReminders = new Set(); // Track which reminders have been shown

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    setupEventListeners();
    
    // Request notification permission on load
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Check reminders immediately and then every 30 seconds
    checkReminders();
    setInterval(checkReminders, 30000);
});

// Event Listeners
function setupEventListeners() {
    addNoteBtn.addEventListener('click', () => openModal());
    closeModal.addEventListener('click', closeModalHandler);
    cancelBtn.addEventListener('click', closeModalHandler);
    categoryFilter.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderNotes();
    });
    noteForm.addEventListener('submit', handleFormSubmit);
    isReminderCheckbox.addEventListener('change', (e) => {
        reminderDateGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Close modal when clicking outside
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            closeModalHandler();
        }
    });
}

// Fetch API - Load all notes
async function loadNotes() {
    try {
        const response = await fetch(`${API_BASE_URL}/notes`);
        if (!response.ok) throw new Error('Failed to load notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        console.error('Error loading notes:', error);
        showNotification('Failed to load notes. Please refresh the page.', 'error');
    }
}

// Fetch API - Create note
async function createNote(noteData) {
    try {
        const response = await fetch(`${API_BASE_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to create note`);
        }
        const newNote = await response.json();
        notes.push(newNote);
        renderNotes();
        showNotification('Note created successfully!', 'success');
        return newNote;
    } catch (error) {
        console.error('Error creating note:', error);
        showNotification(`Failed to create note: ${error.message}`, 'error');
        throw error;
    }
}

// Fetch API - Update note
async function updateNote(id, noteData) {
    try {
        const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
        });
        
        if (!response.ok) throw new Error('Failed to update note');
        const updatedNote = await response.json();
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index] = updatedNote;
        }
        renderNotes();
        showNotification('Note updated successfully!', 'success');
        return updatedNote;
    } catch (error) {
        console.error('Error updating note:', error);
        showNotification('Failed to update note. Please try again.', 'error');
        throw error;
    }
}

// Fetch API - Delete note
async function deleteNote(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete note');
        notes = notes.filter(n => n.id !== id);
        renderNotes();
        showNotification('Note deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting note:', error);
        showNotification('Failed to delete note. Please try again.', 'error');
    }
}

// Fetch API - Toggle completion
async function toggleCompletion(id, completed) {
    if (!id) {
        console.error('No note ID provided for toggle completion');
        showNotification('Error: No note ID provided', 'error');
        return;
    }
    
    try {
        console.log(`Toggling completion for note ${id} to ${completed}`);
        
        const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed: completed })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || errorData.details || `HTTP ${response.status}: Failed to update note`;
            console.error('API error:', errorMsg);
            throw new Error(errorMsg);
        }
        
        const updatedNote = await response.json();
        console.log('Note updated successfully:', updatedNote);
        
        // Update local notes array
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index] = updatedNote;
        } else {
            // If note not found locally, reload all notes
            console.warn('Note not found in local array, reloading notes');
            await loadNotes();
            return;
        }
        
        // Re-render to show updated state
        renderNotes();
        
        // Show success notification
        const statusText = completed ? 'marked as completed' : 'marked as incomplete';
        showNotification(`Note ${statusText}!`, 'success');
    } catch (error) {
        console.error('Error toggling completion:', error);
        showNotification(`Failed to update note: ${error.message}`, 'error');
    }
}

// Render notes with filtering
function renderNotes() {
    const filteredNotes = currentFilter === 'all' 
        ? notes 
        : notes.filter(note => note.category === currentFilter);
    
    notesGrid.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        emptyState.classList.add('show');
        return;
    }
    
    emptyState.classList.remove('show');
    
    filteredNotes.forEach(note => {
        const noteCard = createNoteCard(note);
        notesGrid.appendChild(noteCard);
    });
}

// Create note card element
function createNoteCard(note) {
    const card = document.createElement('div');
    card.className = `note-card ${note.completed ? 'completed' : ''}`;
    card.dataset.noteId = note.id;
    
    const reminderInfo = note.isReminder && note.reminderDate
        ? `<div class="note-reminder">⏰ Reminder: ${formatDateTime(note.reminderDate)}</div>`
        : '';
    
    card.innerHTML = `
        <div class="note-header">
            <div>
                <div class="note-title">${escapeHtml(note.title)}</div>
                <span class="note-category">${escapeHtml(note.category)}</span>
            </div>
        </div>
        <div class="note-content">${escapeHtml(note.content)}</div>
        ${reminderInfo}
        <div class="note-meta">
            Created: ${formatDateTime(note.createdAt)}
            ${note.updatedAt !== note.createdAt ? ` | Updated: ${formatDateTime(note.updatedAt)}` : ''}
        </div>
        <div class="note-actions">
            <button class="btn btn-toggle-complete ${note.completed ? 'btn-completed' : 'btn-complete'}" 
                    data-note-id="${note.id}" data-completed="${note.completed}">
                ${note.completed ? '✓ Completed' : 'Mark Complete'}
            </button>
            <button class="btn btn-edit" data-note-id="${note.id}">Edit</button>
            <button class="btn btn-danger" data-note-id="${note.id}">Delete</button>
        </div>
    `;
    
    // Add event listeners
    const toggleBtn = card.querySelector('.btn-toggle-complete');
    toggleBtn.addEventListener('click', () => {
        const noteId = toggleBtn.dataset.noteId;
        const currentCompleted = toggleBtn.dataset.completed === 'true';
        toggleCompletion(noteId, !currentCompleted);
    });
    
    const editBtn = card.querySelector('.btn-edit');
    editBtn.addEventListener('click', () => {
        editNote(editBtn.dataset.noteId);
    });
    
    const deleteBtn = card.querySelector('.btn-danger');
    deleteBtn.addEventListener('click', () => {
        confirmDelete(deleteBtn.dataset.noteId);
    });
    
    return card;
}

// Modal functions
function openModal(noteId = null) {
    editingNoteId = noteId;
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            modalTitle.textContent = 'Edit Note';
            document.getElementById('noteId').value = note.id;
            document.getElementById('noteTitle').value = note.title;
            document.getElementById('noteContent').value = note.content;
            document.getElementById('noteCategory').value = note.category;
            document.getElementById('isReminder').checked = note.isReminder || false;
            document.getElementById('reminderDate').value = note.reminderDate 
                ? new Date(note.reminderDate).toISOString().slice(0, 16)
                : '';
            reminderDateGroup.style.display = note.isReminder ? 'block' : 'none';
        }
    } else {
        modalTitle.textContent = 'Add New Note';
        noteForm.reset();
        reminderDateGroup.style.display = 'none';
    }
    
    noteModal.classList.add('show');
}

function closeModalHandler() {
    noteModal.classList.remove('show');
    noteForm.reset();
    editingNoteId = null;
    reminderDateGroup.style.display = 'none';
}

// Form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const noteData = {
        title: document.getElementById('noteTitle').value.trim(),
        content: document.getElementById('noteContent').value.trim(),
        category: document.getElementById('noteCategory').value,
        isReminder: document.getElementById('isReminder').checked,
        reminderDate: document.getElementById('isReminder').checked && document.getElementById('reminderDate').value
            ? new Date(document.getElementById('reminderDate').value).toISOString()
            : null
    };
    
    try {
        if (editingNoteId) {
            await updateNote(editingNoteId, noteData);
        } else {
            await createNote(noteData);
        }
        closeModalHandler();
    } catch (error) {
        // Error already handled in create/update functions
    }
}

// Edit note
function editNote(id) {
    openModal(id);
}

// Delete note with confirmation
function confirmDelete(id) {
    if (confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
        deleteNote(id);
    }
}

// Toggle completion function (no longer needs window wrapper)

// Check reminders and show notifications
function checkReminders() {
    const now = new Date();
    
    notes.forEach(note => {
        if (note.isReminder && note.reminderDate && !note.completed) {
            const reminderTime = new Date(note.reminderDate);
            const timeDiff = reminderTime - now;
            const reminderKey = `${note.id}-${note.reminderDate}`;
            
            // Show notification if:
            // 1. Reminder time has passed (timeDiff <= 0) OR
            // 2. Reminder is within the next 5 minutes (0 < timeDiff <= 300000)
            // 3. And hasn't been shown yet
            if (timeDiff <= 300000 && !shownReminders.has(reminderKey)) {
                showReminderNotification(note);
                shownReminders.add(reminderKey);
            }
        }
    });
}

// Show reminder notification
function showReminderNotification(note) {
    const reminderTime = new Date(note.reminderDate);
    const now = new Date();
    const timeDiff = reminderTime - now;
    
    let timeText = '';
    if (timeDiff < 0) {
        const minutesAgo = Math.floor(Math.abs(timeDiff) / 60000);
        timeText = `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
    } else {
        const minutesLeft = Math.floor(timeDiff / 60000);
        timeText = `in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
    }
    
    // Always show in-page notification first
    showNotification(`⏰ Reminder: ${note.title} (${timeText})`, 'reminder');
    
    // Browser notification (requires permission)
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            try {
                new Notification(`Reminder: ${note.title}`, {
                    body: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
                    icon: '📚',
                    tag: note.id,
                    requireInteraction: false
                });
            } catch (error) {
                console.error('Error showing browser notification:', error);
            }
        } else if (Notification.permission !== 'denied') {
            // Request permission if not yet asked
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    try {
                        new Notification(`Reminder: ${note.title}`, {
                            body: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
                            icon: '📚',
                            tag: note.id
                        });
                    } catch (error) {
                        console.error('Error showing browser notification:', error);
                    }
                }
            });
        }
    }
}

// Utility functions
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'reminder' ? '#ffc107' : '#667eea'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideInRight 0.3s;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
