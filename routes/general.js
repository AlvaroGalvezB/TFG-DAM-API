const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name, phone_number, role_name, organization_description } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const [roles] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role_name]);
        if (roles.length === 0) {
            return res.status(400).json({ message: 'Rol inválido' });
        }
        const role_id = roles[0].role_id;

        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash, full_name, phone_number, role_id, organization_description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, full_name, phone_number, role_id, organization_description]
        );

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.status(201).json({
            token,
            user: {
                id: result.insertId,
                username,
                email,
                role_name
            }
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('username')) {
            return res.status(400).json({ message: 'El nombre de usuario ya existe' });
        }
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Email y contraseña son requeridos'
            });
        }

        const [users] = await pool.query(
            'SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Email o contraseña incorrectos' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(400).json({ message: 'Email o contraseña incorrectos' });
        }

        const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
            expiresIn: '24h'
        });

        res.json({
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role_id: user.role_id,
                role_name: user.role_name
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT u.username, u.email, u.phone_number, u.organization_description, r.role_name ' +
            'FROM users u ' +
            'JOIN roles r ON u.role_id = r.role_id ' +
            'WHERE u.user_id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener el perfil' });
    }
});

// Update user profile
router.put('/update-profile', auth, async (req, res) => {
    try {
        const { username, email, phone_number, organization_description } = req.body;

        // Verificar si el email ya existe (excluyendo el usuario actual)
        if (email) {
            const [existingEmail] = await pool.query(
                'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
                [email, req.user.id]
            );
            if (existingEmail.length > 0) {
                return res.status(400).json({ message: 'El email ya está en uso' });
            }
        }

        // Actualizar los datos del usuario
        await pool.query(
            'UPDATE users SET username = ?, email = ?, phone_number = ?, organization_description = ? WHERE user_id = ?',
            [username, email, phone_number, organization_description, req.user.id]
        );

        res.json({ message: 'Perfil actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar el perfil' });
    }
});

module.exports = router;