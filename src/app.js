const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const occurrenceRoutes = require('./routes/occurrenceRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const neighborhoodsRoutes = require('./routes/neighborhoods');
const categoriesRoutes = require('./routes/categories');
const subcategoriesRoutes = require('./routes/subcategories');
const usersRoutes = require('./routes/usersRoutes');
const cors = require('cors');

const app = express();

app.use(express.json());

app.use(cors());

app.use('/api', healthRoutes);

app.use('/api', authRoutes);

app.use('/api', occurrenceRoutes);

app.use('/api', evaluationRoutes);

app.use('/api', neighborhoodsRoutes);

app.use('/api', categoriesRoutes);

app.use('/api', subcategoriesRoutes);

app.use('/api', usersRoutes);

module.exports = app;
