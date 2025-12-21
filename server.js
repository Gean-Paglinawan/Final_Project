const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'notes.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  // Initialize notes.json if it doesn't exist
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
  }
}

// Read notes from file
async function readNotes() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    
    // Handle empty file
    if (!data.trim()) {
      console.warn('Notes file is empty, initializing with empty array');
      await writeNotes([]);
      return [];
    }
    
    const parsed = JSON.parse(data);
    
    // Validate that parsed data is an array
    if (!Array.isArray(parsed)) {
      console.error('Notes file does not contain an array, resetting');
      await writeNotes([]);
      return [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading notes (corrupted file detected):', error.message);
    
    // Backup corrupted file
    try {
      const backupFile = `${DATA_FILE}.corrupted.${Date.now()}`;
      const corruptedData = await fs.readFile(DATA_FILE, 'utf8');
      await fs.writeFile(backupFile, corruptedData);
      console.log(`Corrupted file backed up to: ${backupFile}`);
    } catch (backupError) {
      console.error('Could not backup corrupted file:', backupError.message);
    }
    
    // Reset to empty array
    try {
      await writeNotes([]);
      console.log('Notes file reset to empty array');
    } catch (resetError) {
      console.error('Could not reset notes file:', resetError.message);
    }
    
    return [];
  }
}

// Write notes to file
async function writeNotes(notes) {
  try {
    // Validate that notes is an array
    if (!Array.isArray(notes)) {
      throw new Error('Notes must be an array');
    }
    
    // Write to a temporary file first, then rename (atomic write)
    const tempFile = `${DATA_FILE}.tmp`;
    const jsonData = JSON.stringify(notes, null, 2);
    
    await fs.writeFile(tempFile, jsonData, 'utf8');
    await fs.rename(tempFile, DATA_FILE);
    
    return true;
  } catch (error) {
    console.error('Error writing notes:', error);
    console.error('Error details:', error.message, error.stack);
    
    // Clean up temp file if it exists
    try {
      const tempFile = `${DATA_FILE}.tmp`;
      await fs.unlink(tempFile).catch(() => {}); // Ignore errors if file doesn't exist
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

// API Routes

// GET all notes
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await readNotes();
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET note by ID
app.get('/api/notes/:id', async (req, res) => {
  try {
    const notes = await readNotes();
    const note = notes.find(n => n.id === req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST create new note
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content, category, reminderDate, isReminder } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const notes = await readNotes();
    const newNote = {
      id: Date.now().toString(),
      title,
      content,
      category: category || 'Personal',
      reminderDate: reminderDate || null,
      isReminder: isReminder || false,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    notes.push(newNote);
    const writeSuccess = await writeNotes(notes);
    if (!writeSuccess) {
      return res.status(500).json({ error: 'Failed to save note' });
    }
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note', details: error.message });
  }
});

// PUT update note
app.put('/api/notes/:id', async (req, res) => {
  try {
    const notes = await readNotes();
    const index = notes.findIndex(n => n.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { title, content, category, reminderDate, isReminder, completed } = req.body;
    
    notes[index] = {
      ...notes[index],
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
      ...(reminderDate !== undefined && { reminderDate }),
      ...(isReminder !== undefined && { isReminder }),
      ...(completed !== undefined && { completed }),
      updatedAt: new Date().toISOString()
    };

    const writeSuccess = await writeNotes(notes);
    if (!writeSuccess) {
      return res.status(500).json({ error: 'Failed to save note after update' });
    }
    res.json(notes[index]);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note', details: error.message });
  }
});

// DELETE note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const notes = await readNotes();
    const filteredNotes = notes.filter(n => n.id !== req.params.id);
    
    if (notes.length === filteredNotes.length) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const writeSuccess = await writeNotes(filteredNotes);
    if (!writeSuccess) {
      return res.status(500).json({ error: 'Failed to save notes after deletion' });
    }
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note', details: error.message });
  }
});

// POST reset data (for emergency recovery)
app.post('/api/reset', async (req, res) => {
  try {
    const writeSuccess = await writeNotes([]);
    if (!writeSuccess) {
      return res.status(500).json({ error: 'Failed to reset data' });
    }
    res.json({ message: 'Data reset successfully' });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ error: 'Failed to reset data', details: error.message });
  }
});

// Initialize server
async function startServer() {
  try {
    await ensureDataDir();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
