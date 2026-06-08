
export const adminAuth = (req, res, next) => {
    const authHeader = req.headers['x-admin-key'];
    const secret = process.env.DEV_DASHBOARD_KEY;

    if (!secret) {
        console.error('[Auth] DEV_DASHBOARD_KEY no configurada — todas las rutas admin bloqueadas');
        return res.status(503).json({
            status: 'error',
            data: null,
            message: 'Administración no disponible: clave no configurada'
        });
    }

    if (authHeader === secret) {
        next();
    } else {
        console.warn(`[Auth] Acceso denegado a ruta protegida: ${req.path}`);
        res.status(403).json({ 
            status: 'error', 
            data: null, 
            message: 'Acceso denegado: Clave de administrador inválida' 
        });
    }
};
