const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const { put } = require('@vercel/blob');

// Configurar multer para almacenamiento en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB límite
  }
});

router.post('/create', auth, upload.single('image_file'), async (req, res) => {
  try {
    const { 
      title, 
      description, 
      event_date,
      location,
      volunteer_limit
    } = req.body;

    if (!title || !description || !event_date || !location) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    let imageUrl = null;

    if (req.file) {
      try {
        console.log('Procesando archivo:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });

        const blob = await put(req.file.originalname, req.file.buffer, {
          access: 'public',
          contentType: req.file.mimetype,
          addRandomSuffix: true
        });

        console.log('Blob creado exitosamente:', blob);
        imageUrl = blob.url;
      } catch (error) {
        console.error('Error detallado en la subida:', {
          error: error.message,
          stack: error.stack,
          file: req.file
        });
        return res.status(500).json({ 
          message: 'Error al subir la imagen',
          error: error.message 
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO events (
        user_id,
        title,
        description, 
        event_date, 
        location,
        volunteer_limit,
        image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description, event_date, location, volunteer_limit || null, imageUrl]
    );

    res.status(201).json({
      message: 'Evento creado exitosamente',
      event_id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).json({ message: 'Error al crear el evento: ' + error.message });
  }
});

// Añadir nueva ruta para listar eventos de la ONG
router.get('/list', auth, async (req, res) => {
  try {
    const [events] = await pool.query(`
      SELECT *
      FROM events
      WHERE user_id = ?
      ORDER BY event_date DESC
    `, [req.user.id]);

    res.json(events);
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(500).json({ message: 'Error al obtener los eventos' });
  }
});

// Endpoint para eliminar un evento
router.delete('/delete/:eventId', auth, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    
    // Verificar que el evento pertenece al usuario
    const [event] = await pool.query(
      'SELECT * FROM events WHERE event_id = ? AND user_id = ?',
      [eventId, req.user.id]
    );

    if (event.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado o no tienes permiso para eliminarlo' });
    }

    // Eliminar el evento
    await pool.query('DELETE FROM events WHERE event_id = ?', [eventId]);

    res.json({ message: 'Evento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar evento:', error);
    res.status(500).json({ message: 'Error al eliminar el evento' });
  }
});

// Endpoint para editar un evento
router.put('/edit/:eventId', auth, upload.single('image_file'), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const {
      title,
      description,
      event_date,
      location,
      volunteer_limit
    } = req.body;

    // Verificar que el evento pertenece al usuario
    const [event] = await pool.query(
      'SELECT * FROM events WHERE event_id = ? AND user_id = ?',
      [eventId, req.user.id]
    );

    if (event.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado o no tienes permiso para editarlo' });
    }

    let imageUrl = event[0].image_url; // Mantener la imagen existente por defecto

    if (req.file) {
      try {
        const blob = await put(req.file.originalname, req.file.buffer, {
          access: 'public',
          contentType: req.file.mimetype,
          addRandomSuffix: true
        });
        imageUrl = blob.url;
      } catch (error) {
        console.error('Error al subir la nueva imagen:', error);
        return res.status(500).json({ 
          message: 'Error al actualizar la imagen',
          error: error.message 
        });
      }
    }

    // Actualizar el evento
    await pool.query(
      `UPDATE events 
       SET title = ?, 
           description = ?, 
           event_date = ?, 
           location = ?, 
           volunteer_limit = ?,
           image_url = ?
       WHERE event_id = ?`,
      [title, description, event_date, location, volunteer_limit || null, imageUrl, eventId]
    );

    res.json({ 
      message: 'Evento actualizado exitosamente',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error al actualizar evento:', error);
    res.status(500).json({ message: 'Error al actualizar el evento' });
  }
});

// Endpoint para obtener un evento específico
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    
    // Verificar que el evento pertenece al usuario
    const [event] = await pool.query(
      'SELECT * FROM events WHERE event_id = ? AND user_id = ?',
      [eventId, req.user.id]
    );

    if (event.length === 0) {
      return res.status(404).json({ message: 'Evento no encontrado o no tienes permiso para verlo' });
    }

    res.json(event[0]);
  } catch (error) {
    console.error('Error al obtener el evento:', error);
    res.status(500).json({ message: 'Error al obtener el evento' });
  }
});

module.exports = router;