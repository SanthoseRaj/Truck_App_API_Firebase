const app = require('./server');

const port = process.env.PORT || 5000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger URL: http://localhost:${port}/api-docs`);
});
