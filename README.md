# Student Notes and Reminders Web App

A simple CRUD application for students to manage notes and reminders with category filtering.

## Features

- ✅ **Add/Edit/Delete Notes** - Full CRUD functionality
- ✅ **Mark Reminders as Completed** - Track your progress
- ✅ **Category Filtering** - Filter by School, Personal, Work, or Other
- ✅ **Reminder System** - Set date/time reminders for important notes
- ✅ **Local Notifications** - Browser notifications for reminders
- ✅ **Modern UI** - Beautiful, responsive design

## Tech Stack

- **Backend**: Node.js, Express.js
- **Storage**: JSON file-based storage
- **Frontend**: HTML, CSS, JavaScript
- **API**: Fetch API for backend communication

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## API Endpoints

- `GET /api/notes` - Get all notes
- `GET /api/notes/:id` - Get a specific note
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

## Usage

1. **Add a Note**: Click the "Add New Note" button
2. **Edit a Note**: Click the "Edit" button on any note card
3. **Delete a Note**: Click the "Delete" button (with confirmation)
4. **Mark as Complete**: Click "Mark Complete" to mark reminders as done
5. **Filter by Category**: Use the dropdown to filter notes by category
6. **Set Reminders**: Check "Set as Reminder" and choose a date/time

## Data Storage

Notes are stored in `data/notes.json`. The file is automatically created on first run.

## Browser Notifications

The app will request permission to show browser notifications for reminders. Notifications appear when a reminder time is reached.

## License

ISC
