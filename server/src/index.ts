import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import booksRoutes from './routes/books';
import wordsRoutes from './routes/words';
import adminRoutes from './routes/admin';
import progressRoutes from './routes/progress';
import parsingRoutes from './routes/parsing';
import activitiesRoutes from './routes/activities';
import ttsRoutes from './api/tts';
import elevenlabsRoutes from './api/elevenlabs';
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage.js';

dotenv.config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Trust proxy for accurate client IPs in production
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static audio files
app.use('/audio', express.static('public/audio'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', booksRoutes);
app.use('/api/words', wordsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/parsing', parsingRoutes);
app.use('/api', activitiesRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/elevenlabs', elevenlabsRoutes);


// Object Storage Routes - Serve uploaded images
app.get('/objects/:objectPath(*)', async (req, res) => {
  const objectStorageService = new ObjectStorageService();
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(req.path);
    objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error('Error serving object:', error);
    if (error instanceof ObjectNotFoundError) {
      return res.sendStatus(404);
    }
    return res.sendStatus(500);
  }
});

// Serve public objects (like book covers)
app.get('/public-objects/:filePath(*)', async (req, res) => {
  const filePath = req.params.filePath;
  const objectStorageService = new ObjectStorageService();
  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    objectStorageService.downloadObject(file, res);
  } catch (error) {
    console.error('Error serving public object:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Spanish Storybooks API is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

export default app;