const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all events
router.get('/list', async (req, res) => {
    try {
        const [events] = await pool.query(`
            SELECT *
            FROM events
            WHERE event_date >= NOW()
            ORDER BY event_date ASC
        `);

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error al obtener eventos' });
    }
});

// Register user for an event
router.post('/register', auth, async (req, res) => {
    try {
        const { event_id, registration_date } = req.body;
        const user_id = req.user.id;

        // Verificar si el usuario ya está registrado en el evento
        const [existingRegistration] = await pool.query(
            'SELECT * FROM event_registrations WHERE user_id = ? AND event_id = ?',
            [user_id, event_id]
        );

        if (existingRegistration.length > 0) {
            return res.status(400).json({ message: 'Ya estás registrado en este evento' });
        }

        // Verificar límite de voluntarios
        const [event] = await pool.query(
            'SELECT volunteer_limit, registered_volunteers FROM events WHERE event_id = ?',
            [event_id]
        );

        if (event.length > 0 && event[0].volunteer_limit !== null) {
            if (event[0].registered_volunteers >= event[0].volunteer_limit) {
                return res.status(400).json({ message: 'El evento ha alcanzado el límite de voluntarios' });
            }
        }

        // Iniciar transacción
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Registrar al usuario
            await connection.query(
                'INSERT INTO event_registrations (user_id, event_id, registration_date) VALUES (?, ?, ?)',
                [user_id, event_id, registration_date]
            );

            // Incrementar el contador de voluntarios registrados
            await connection.query(
                'UPDATE events SET registered_volunteers = registered_volunteers + 1 WHERE event_id = ?',
                [event_id]
            );

            await connection.commit();
            connection.release();

            res.status(201).json({ message: 'Registro exitoso en el evento' });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error al registrar en el evento:', error);
        res.status(500).json({ message: 'Error al registrar en el evento' });
    }
});

// Eliminar registro de un evento
router.delete('/unregister/:eventId', auth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userId = req.user.id;

        // Iniciar transacción
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Eliminar el registro
            const [result] = await connection.query(
                'DELETE FROM event_registrations WHERE user_id = ? AND event_id = ?',
                [userId, eventId]
            );

            if (result.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ message: 'No se encontró el registro' });
            }

            // Decrementar el contador de voluntarios registrados
            await connection.query(
                'UPDATE events SET registered_volunteers = registered_volunteers - 1 WHERE event_id = ?',
                [eventId]
            );

            await connection.commit();
            connection.release();

            res.json({ message: 'Registro eliminado exitosamente' });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error al eliminar registro:', error);
        res.status(500).json({ message: 'Error al eliminar el registro del evento' });
    }
});

// Obtener los IDs de eventos en los que el usuario está registrado
router.get('/user-registrations', auth, async (req, res) => {
    try {
        const [registrations] = await pool.query(
            'SELECT event_id FROM event_registrations WHERE user_id = ?',
            [req.user.id]
        );

        const eventIds = registrations.map(reg => reg.event_id);
        res.json(eventIds);
    } catch (error) {
        console.error('Error al obtener registros del usuario:', error);
        res.status(500).json({ message: 'Error al obtener los registros' });
    }
});

// Obtener eventos pasados en los que está inscrito el usuario
router.get('/user-events', auth, async (req, res) => {
    try {
        const [events] = await pool.query(`
            SELECT e.*
            FROM events e
            INNER JOIN event_registrations er ON e.event_id = er.event_id
            WHERE er.user_id = ? AND e.event_date <= NOW()
            ORDER BY e.event_date DESC
        `, [req.user.id]);

        res.json(events);
    } catch (error) {
        console.error('Error al obtener eventos del usuario:', error);
        res.status(500).json({ message: 'Error al obtener los eventos' });
    }
});

module.exports = router;