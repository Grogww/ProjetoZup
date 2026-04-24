const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const occurrenceRoutes = require('./routes/occurrenceRoutes');
const neighborhoodsRoutes = require('./routes/neighborhoods');
const categoriesRoutes = require('./routes/categories');
const subcategoriesRoutes = require('./routes/subcategories');


const app = express();

app.use(express.json());

app.use('/api', healthRoutes);

app.use('/api', authRoutes);

app.use('/api', occurrenceRoutes);

app.use('/api', neighborhoodsRoutes);

app.use('/api', categoriesRoutes);

app.use('/api', subcategoriesRoutes);

module.exports = app;
