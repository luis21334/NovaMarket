const express = require('express');
const pool = require('./db');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- RUTAS PÚBLICAS ---

// Obtener productos
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login (Clientes y Admin)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ success: true, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
        } else {
            res.status(401).json({ success: false });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registro de Clientes
app.post('/api/registro', async (req, res) => {
    const { nombre, email, password } = req.body;
    try {
        const check = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Correo ya registrado" });

        await pool.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
            [nombre, email, password, 'cliente']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Procesar Compra
app.post('/api/comprar', async (req, res) => {
    const { carrito, cliente, email, metodoPago } = req.body; 
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let total = 0;
        for (const item of carrito) total += item.precio * item.cantidad;

        // TRUCO: Guardamos "Nombre (email)" en el campo cliente_nombre para poder buscarlo después
        const identificadorCliente = email ? `${cliente} (${email})` : `${cliente} (Anónimo)`;

        const pedidoRes = await client.query(
            'INSERT INTO pedidos (total, cliente_nombre) VALUES ($1, $2) RETURNING id',
            [total, `${identificadorCliente} - ${metodoPago}`] 
        );
        const pedidoId = pedidoRes.rows[0].id;

        for (const item of carrito) {
            const stockRes = await client.query('SELECT stock FROM productos WHERE id = $1', [item.id]);
            if (stockRes.rows[0].stock < item.cantidad) throw new Error(`Stock insuficiente: ${item.nombre}`);

            await client.query('INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)', [pedidoId, item.id, item.cantidad, item.precio]);
            await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, pedidoId, total });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// --- RUTAS DE GERENTE ---

// Ver historial de un cliente específico
app.get('/api/admin/historial/:email', async (req, res) => {
    const { email } = req.params;
    try {
        // Busca pedidos donde el nombre del cliente contenga el email
        const result = await pool.query(
            "SELECT id, fecha, total, cliente_nombre FROM pedidos WHERE cliente_nombre ILIKE $1 ORDER BY id DESC", 
            [`%${email}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/clientes', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nombre, email FROM usuarios WHERE rol = 'cliente'");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/clientes/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        await pool.query('UPDATE usuarios SET password = $1 WHERE email = $2', [newPassword, email]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const ingresos = await pool.query('SELECT SUM(total) as total, COUNT(*) as ventas FROM pedidos');
        const stockBajo = await pool.query('SELECT COUNT(*) as cant FROM productos WHERE stock < 5');
        const topProd = await pool.query(`
            SELECT p.nombre, SUM(dp.cantidad) as vendidos 
            FROM detalles_pedido dp JOIN productos p ON dp.producto_id = p.id
            GROUP BY p.nombre ORDER BY vendidos DESC LIMIT 5
        `);
        const ventasHoy = await pool.query("SELECT SUM(total) as total FROM pedidos WHERE date_trunc('day', fecha) = CURRENT_DATE");

        res.json({
            ingresos: ingresos.rows[0].total || 0,
            ventas: ingresos.rows[0].ventas || 0,
            stockBajo: stockBajo.rows[0].cant || 0,
            topProductos: topProd.rows,
            corteHoy: ventasHoy.rows[0].total || 0
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CRUD Productos
app.post('/api/admin/productos', async (req, res) => {
    const { nombre, precio, stock, imagen_url, categoria } = req.body;
    try { await pool.query('INSERT INTO productos (nombre, precio, stock, imagen_url, categoria) VALUES ($1, $2, $3, $4, $5)', [nombre, precio, stock, imagen_url, categoria]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/admin/productos/:id', async (req, res) => {
    const { nombre, precio, stock, imagen_url, categoria } = req.body;
    try { await pool.query('UPDATE productos SET nombre=$1, precio=$2, stock=$3, imagen_url=$4, categoria=$5 WHERE id=$6', [nombre, precio, stock, imagen_url, categoria, req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/productos/:id', async (req, res) => {
    try { await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));