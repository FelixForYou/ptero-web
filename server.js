require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

require('./db'); // init schema

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const serverRoutes = require('./routes/servers');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api', serverRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ptero Web jalan di http://localhost:${PORT}`);
});
