require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const journalsRouter = require('./routes/journals');
const entriesRouter = require('./routes/entries');
const profilesRouter = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'travel-journal-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use('/api/journals', journalsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/profiles', profilesRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Travel Journal running at http://localhost:${PORT}`);
});

