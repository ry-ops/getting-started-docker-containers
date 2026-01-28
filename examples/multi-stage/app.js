const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Multi-stage build example',
    optimizations: [
      'Separate build and runtime stages',
      'Production dependencies only',
      'Minimal final image size',
      'Layer caching optimization',
      'Non-root user for security'
    ],
    imageSize: 'Significantly reduced compared to single-stage builds'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Multi-stage app running on port ${port}`);
});
