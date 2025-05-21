const express = require('express');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();

app.use(cors());
app.use(express.json());

const generalRoutes = require('./routes/general');
const ongRoutes = require('./routes/ong');
const volunteerRoutes = require('./routes/volunteer');

app.use('/api/general', generalRoutes);
app.use('/api/ong', ongRoutes);
app.use('/api/volunteer', volunteerRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
