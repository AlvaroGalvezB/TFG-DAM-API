const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ message: 'No token, autorización denegada' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Formato de token inválido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token no válido' });
    }
};
