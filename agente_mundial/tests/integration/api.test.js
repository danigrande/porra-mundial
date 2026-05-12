import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../routes/api.js';

// Evitar el middleware de conexión a DB configurando el entorno
process.env.NODE_ENV = 'development';

// Creamos una app Express "falsa" en memoria para montar nuestras rutas
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Añadimos una ruta de salud básica a la app principal de prueba
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

describe('API Integration Tests (Express Router)', () => {

  describe('Rutas Generales', () => {
    
    it('GET /health debe devolver 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it('GET /api/ruta-inexistente debe devolver 404', async () => {
      const response = await request(app).get('/api/ruta-inexistente');
      expect(response.status).toBe(404);
    });

  });

  describe('Seguridad y Autenticación', () => {
    
    it('POST /api/admin/simulate-match debe fallar (403) si no se provee x-admin-key', async () => {
      const response = await request(app)
        .post('/api/admin/simulate-match')
        .send({ action: 'update', changes: {} });
      
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toMatch(/Acceso denegado/i);
    });

    it('POST /api/admin/simulate-match debe fallar (403) si la x-admin-key es incorrecta', async () => {
      const response = await request(app)
        .post('/api/admin/simulate-match')
        .set('x-admin-key', 'CLAVE_FALSA')
        .send({ action: 'update', changes: {} });
      
      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/Acceso denegado/i);
    });

  });

});
