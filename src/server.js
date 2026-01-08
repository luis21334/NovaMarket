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

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] });
        else res.status(401).json({ success: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// REALIZAR COMPRA (Actualiza inventario y genera ticket)
app.post('/api/comprar', async (req, res) => {
    const { carrito, cliente } = req.body; // carrito es array de {id, cantidad, precio}
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Calcular total
        let total = 0;
        for (const item of carrito) {
            total += item.precio * item.cantidad;
        }

        // 2. Crear el pedido
        const pedidoRes = await client.query(
            'INSERT INTO pedidos (total, cliente_nombre) VALUES ($1, $2) RETURNING id',
            [total, cliente || 'Cliente General']
        );
        const pedidoId = pedidoRes.rows[0].id;

        // 3. Insertar detalles y BAJAR STOCK
        for (const item of carrito) {
            // Verificar stock primero
            const stockRes = await client.query('SELECT stock FROM productos WHERE id = $1', [item.id]);
            if (stockRes.rows[0].stock < item.cantidad) {
                throw new Error(`Stock insuficiente para el producto ID ${item.id}`);
            }

            // Insertar detalle
            await client.query(
                'INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
                [pedidoId, item.id, item.cantidad, item.precio]
            );

            // Restar inventario
            await client.query(
                'UPDATE productos SET stock = stock - $1 WHERE id = $2',
                [item.cantidad, item.id]
            );
        }

        await client.query('COMMIT'); // Guardar cambios
        res.json({ success: true, pedidoId, total });

    } catch (err) {
        await client.query('ROLLBACK'); // Cancelar si falla algo
        res.status(400).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// --- RUTAS DE ADMINISTRADOR (Gerente) ---

// Agregar Producto
app.post('/api/admin/productos', async (req, res) => {
    const { nombre, precio, stock, imagen_url, categoria } = req.body;
    try {
        await pool.query(
            'INSERT INTO productos (nombre, precio, stock, imagen_url, categoria) VALUES ($1, $2, $3, $4, $5)',
            [nombre, precio, stock, imagen_url, categoria]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Editar Producto
app.put('/api/admin/productos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock, imagen_url, categoria } = req.body;
    try {
        await pool.query(
            'UPDATE productos SET nombre=$1, precio=$2, stock=$3, imagen_url=$4, categoria=$5 WHERE id=$6',
            [nombre, precio, stock, imagen_url, categoria, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Eliminar Producto
app.delete('/api/admin/productos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM productos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));