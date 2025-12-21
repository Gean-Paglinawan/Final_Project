const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
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
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading notes:', error);
    return [];
  }
}

// Write notes to file
async function writeNotes(notes) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(notes, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing notes:', error);
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
    await writeNotes(notes);
    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
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

    await writeNotes(notes);
    res.json(notes[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
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

    await writeNotes(filteredNotes);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Initialize server
async function startServer() {
  await ensureDataDir();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
