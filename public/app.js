let carrito = [];
let esAdmin = false;
let productos = []; // Lista global de productos

document.addEventListener('DOMContentLoaded', cargarProductos);

// --- CARGA DE DATOS ---
async function cargarProductos() {
    try {
        const res = await fetch('/api/productos');
        productos = await res.json();
        
        // 1. Generar botones de categorías basados en lo que hay
        generarBotonesCategorias();
        
        // 2. Mostrar todos los productos al inicio
        renderizarProductos(productos);
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

// --- LÓGICA DE FILTROS Y BÚSQUEDA ---
function generarBotonesCategorias() {
    const contenedor = document.getElementById('filtros-categorias');
    // Obtener categorías únicas, limpiando vacíos
    const categorias = ['Todas', ...new Set(productos.map(p => p.categoria || 'Otros'))];
    
    contenedor.innerHTML = ''; // Limpiar

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerText = cat;
        btn.className = cat === 'Todas' ? 'btn-cat active' : 'btn-cat';
        btn.onclick = () => {
            // Quitar clase active a todos
            document.querySelectorAll('.btn-cat').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtrarPorCategoria(cat);
        };
        contenedor.appendChild(btn);
    });
}

function filtrarPorCategoria(categoria) {
    if (categoria === 'Todas') {
        renderizarProductos(productos);
    } else {
        // Filtrar productos que coincidan con la categoría (o 'Otros' si es null)
        const filtrados = productos.filter(p => (p.categoria || 'Otros') === categoria);
        renderizarProductos(filtrados);
    }
}

function filtrarProductos() {
    const texto = document.getElementById('buscador').value.toLowerCase();
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(texto) || 
        (p.categoria && p.categoria.toLowerCase().includes(texto))
    );
    renderizarProductos(filtrados);
}

// --- RENDERIZADO (VISUALIZACIÓN) ---
function renderizarProductos(lista) {
    const contenedor = document.getElementById('grid-productos');
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;"><h3>😕 No encontramos productos con esa búsqueda.</h3></div>';
        return;
    }

    lista.forEach(p => {
        // Botones de Admin
        let adminBtns = '';
        if (esAdmin) {
            adminBtns = `
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button style="flex:1; padding:5px; font-size:0.8rem;" onclick="editarProducto(${p.id})">✏️</button>
                    <button class="btn-danger" style="flex:1; padding:5px; font-size:0.8rem;" onclick="borrarProducto(${p.id})">🗑️</button>
                </div>
            `;
        }

        // Lógica de Stock
        const stockHtml = p.stock > 0 
            ? `<span class="stock-badge">Disponibles: ${p.stock}</span>`
            : `<span class="stock-badge stock-low">Agotado</span>`;

        const btnCompra = p.stock > 0 
            ? `<button class="btn-accent" style="width:100%" onclick="agregarCarrito(${p.id})">Agregar al Carrito</button>`
            : `<button style="width:100%; background:#ccc; cursor:not-allowed;" disabled>Sin Stock</button>`;

        // Categoría por defecto
        const cat = p.categoria || 'General';

        contenedor.innerHTML += `
            <div class="card">
                <img src="${p.imagen_url}" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/300?text=Sin+Imagen'">
                <div class="card-body">
                    <div>
                        <div class="card-cat">${cat}</div>
                        <div class="card-title">${p.nombre}</div>
                        ${stockHtml}
                        <div class="card-price">$${p.precio}</div>
                    </div>
                    <div>
                        ${adminBtns}
                        <br>
                        ${btnCompra}
                    </div>
                </div>
            </div>
        `;
    });
}

// --- CARRITO ---
function agregarCarrito(id) {
    const prod = productos.find(p => p.id === id);
    const enCarrito = carrito.find(item => item.id === id);
    const cantidadActual = enCarrito ? enCarrito.cantidad : 0;

    if (cantidadActual >= prod.stock) {
        alert("⚠️ ¡No puedes agregar más! Alcanzaste el stock disponible.");
        return;
    }

    if (enCarrito) {
        enCarrito.cantidad++;
    } else {
        carrito.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
    }
    actualizarUI();
    abrirCarrito(); // Opcional: abre el carrito al agregar
}

function actualizarUI() {
    document.getElementById('count').innerText = carrito.reduce((acc, item) => acc + item.cantidad, 0);
}

function abrirCarrito() {
    const lista = document.getElementById('lista-carrito');
    lista.innerHTML = '';
    let total = 0;

    if(carrito.length === 0) {
        lista.innerHTML = '<p style="text-align:center">Tu carrito está vacío 🛒</p>';
    }

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;">
                <div>
                    <strong>${item.nombre}</strong><br>
                    <small>$${item.precio} x ${item.cantidad}</small>
                </div>
                <div style="text-align:right">
                    <strong>$${subtotal.toFixed(2)}</strong><br>
                    <button style="color:red; background:none; padding:0;" onclick="eliminarItem(${index})">Eliminar</button>
                </div>
            </div>
        `;
    });

    document.getElementById('total-carrito').innerText = total.toFixed(2);
    document.getElementById('modal-carrito').style.display = 'flex';
}

function eliminarItem(index) {
    carrito.splice(index, 1);
    abrirCarrito();
    actualizarUI();
}

async function pagar() {
    if (carrito.length === 0) return alert("Carrito vacío");

    const res = await fetch('/api/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrito, cliente: "Cliente Web" })
    });

    const data = await res.json();
    if (data.success) {
        imprimirTicket(data.pedidoId, data.total);
        carrito = [];
        actualizarUI();
        cerrarModal('modal-carrito');
        cargarProductos(); // Recargar para actualizar stock visualmente
    } else {
        alert("Error: " + data.error);
    }
}

function imprimirTicket(id, total) {
    let ticket = `
    ================================
          NOVAMARKET - TICKET
    ================================
    Pedido ID: #${id}
    Fecha: ${new Date().toLocaleString()}
    --------------------------------
    CANT  PRODUCTO          TOTAL
    --------------------------------
    `;
    carrito.forEach(item => {
        const sub = (item.precio * item.cantidad).toFixed(2);
        const nombre = item.nombre.substring(0,15).padEnd(15);
        ticket += `${item.cantidad}x   ${nombre} $${sub}\n`;
    });
    ticket += `
    --------------------------------
    TOTAL PAGADO:       $${total}
    ================================
    ¡Gracias por su compra!
    `;
    
    const ventana = window.open('', '', 'width=400,height=600');
    ventana.document.write('<pre style="font-family: monospace;">' + ticket + '</pre>');
    ventana.document.close();
    ventana.print();
}

// --- FUNCIONES ADMIN ---
function toggleLogin() { document.getElementById('modal-login').style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('msg-error');

    errorMsg.style.display = 'none'; // Reset error

    if(!email || !password) {
        errorMsg.innerText = "Por favor llena ambos campos";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            esAdmin = true;
            document.getElementById('admin-bar').style.display = 'flex'; // Flex para alinear botones
            cerrarModal('modal-login');
            renderizarProductos(productos); // Recargar para mostrar botones de editar
            // Limpiar inputs
            document.getElementById('login-email').value = '';
            document.getElementById('login-pass').value = '';
        } else {
            errorMsg.innerText = "Usuario o contraseña incorrectos";
            errorMsg.style.display = 'block';
        }
    } catch (e) {
        alert("Error de conexión");
    }
}

function logout() {
    esAdmin = false;
    document.getElementById('admin-bar').style.display = 'none';
    renderizarProductos(productos);
}

// CRUD Admin
let editandoId = null;

function abrirModalProducto() {
    editandoId = null;
    document.getElementById('titulo-modal-prod').innerText = "Nuevo Producto";
    // Limpiar campos
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-img').value = '';
    document.getElementById('prod-cat').value = '';
    document.getElementById('modal-producto').style.display = 'flex';
}

function editarProducto(id) {
    const p = productos.find(x => x.id === id);
    editandoId = id;
    document.getElementById('titulo-modal-prod').innerText = "Editar Producto";
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-img').value = p.imagen_url;
    document.getElementById('prod-cat').value = p.categoria;
    document.getElementById('modal-producto').style.display = 'flex';
}

async function guardarProducto() {
    const datos = {
        nombre: document.getElementById('prod-nombre').value,
        precio: document.getElementById('prod-precio').value,
        stock: document.getElementById('prod-stock').value,
        imagen_url: document.getElementById('prod-img').value,
        categoria: document.getElementById('prod-cat').value
    };

    if(!datos.nombre || !datos.precio) return alert("Nombre y Precio son obligatorios");

    const url = editandoId ? `/api/admin/productos/${editandoId}` : '/api/admin/productos';
    const method = editandoId ? 'PUT' : 'POST';

    await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });

    cerrarModal('modal-producto');
    cargarProductos(); // Esto actualizará la lista y los botones de categoría
}

async function borrarProducto(id) {
    if (!confirm("¿Seguro que quieres borrar este producto?")) return;
    await fetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
    cargarProductos();
}