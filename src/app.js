const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const authRoutes = require('./routes/occurrenceRoutes');


const app = express();

app.use(express.json());

app.use('/api', healthRoutes);

app.use('/api', authRoutes);

app.use('/api', occurrenceRoutes);

module.exports = app;
