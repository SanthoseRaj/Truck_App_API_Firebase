require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const connectDB = require('./config/db');
const swaggerSpec = require('./config/swagger');
// const ensureTruckIndexes = require('./utils/ensureTruckIndexes');
// const ensureShipIndexes = require('./utils/ensureShipIndexes');
// const ensureDriverIndexes = require('./utils/ensureDriverIndexes');
// const ensureSupplierIndexes = require('./utils/ensureSupplierIndexes');
// const seedUsers = require('./utils/seedUsers');
const authRoutes = require('./routes/authRoutes');
const truckRoutes = require('./routes/truckRoutes');
const shipRoutes = require('./routes/shipRoutes');
const driverRoutes = require('./routes/driverRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const truckEntryRoutes = require('./routes/truckEntryRoutes');
const tripRoutes = require('./routes/tripRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const publicRoutes = require('./routes/publicRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('etag', false);
app.use(cors());
app.use(compression({ brotli: { enabled: true } }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});




app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Truck Tracking Backend API is running',
    docs: '/api-docs',
  });
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
      requestInterceptor: (request) => {
        const token = window.localStorage.getItem('truckTrackingJwt');
        const isLoginRequest = request.url.endsWith('/api/auth/login');

        if (token && !isLoginRequest) {
          request.headers.Authorization = `Bearer ${token}`;
        }

        return request;
      },
      responseInterceptor: (response) => {
        const isLoginResponse = response.url.endsWith('/api/auth/login') && response.status === 200;

        if (isLoginResponse && response.text) {
          try {
            const body = JSON.parse(response.text);

            if (body.token) {
              window.localStorage.setItem('truckTrackingJwt', body.token);

              if (window.ui && window.ui.preauthorizeApiKey) {
                window.ui.preauthorizeApiKey('bearerAuth', body.token);
              }
            }
          } catch (error) {
            console.warn('Unable to read login token from Swagger response');
          }
        }

        return response;
      },
    },
  })
);
app.use('/api/auth', authRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/ships', shipRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/truck-entries', truckEntryRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);

app.use(notFound);
app.use(errorHandler);

// const startServer = async () => {
//   try {
//     await connectDB();
//     await ensureShipIndexes();
//     await ensureDriverIndexes();
//     await seedUsers();

//     app.listen(PORT, '0.0.0.0', () => {
//       console.log(`Server running on port ${PORT}`);
//       console.log(`Swagger URL: /api-docs`);
//     });
//   } catch (error) {
//     console.error(`Failed to start server: ${error.message}`);
//     process.exit(1);
//   }
// };

// startServer();


// connectDB()
//   .then(async () => {
//     await ensureTruckIndexes();
//     await ensureShipIndexes();
//     await ensureDriverIndexes();
//     await ensureSupplierIndexes();
//     await seedUsers();
//     console.log('Firebase Function database connected');
//   })
//   .catch((error) => {
//     console.error(`Database connection failed: ${error.message}`);
//   });

module.exports = app;
