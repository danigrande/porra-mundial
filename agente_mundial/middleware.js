
export const adminAuth = (req, res, next) => {
    const authHeader = req.headers['x-admin-key'];
    const secret = process.env.DEV_DASHBOARD_KEY || 'dev_secret_key_123';
    
    if (authHeader === secret) {
        next();
    } else {
        console.warn(`[Auth] 🔐 Acceso denegado a ruta protegida: ${req.path}`);
        res.status(403).json({ 
            status: 'error', 
            data: null, 
            message: 'Acceso denegado: Clave de administrador inválida' 
        });
    }
};
