let carrito = [];
let esAdmin = false;
let productos = []; // Guardamos copia local

document.addEventListener('DOMContentLoaded', cargarProductos);

// --- CARGAR PRODUCTOS ---
async function cargarProductos() {
    const res = await fetch('/api/productos');
    productos = await res.json();
    renderizarProductos();
}

function renderizarProductos() {
    const contenedor = document.getElementById('grid-productos');
    contenedor.innerHTML = '';

    productos.forEach(p => {
        // Botones de admin si está logueado
        let adminBtns = '';
        if (esAdmin) {
            adminBtns = `
                <div class="actions">
                    <button onclick="editarProducto(${p.id})">✏️ Editar</button>
                    <button class="btn-danger" onclick="borrarProducto(${p.id})">🗑️ Borrar</button>
                </div>
            `;
        }

        // Botón de compra (deshabilitado si no hay stock)
        const btnCompra = p.stock > 0 
            ? `<button class="btn-accent" style="width:100%" onclick="agregarCarrito(${p.id})">Agregar al Carrito</button>`
            : `<button style="width:100%; background:#ccc" disabled>Agotado</button>`;

        contenedor.innerHTML += `
            <div class="card">
                <img src="${p.imagen_url}" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/200'">
                <div class="card-body">
                    <div>
                        <div class="card-title">${p.nombre}</div>
                        <div class="card-price">$${p.precio}</div>
                        <div class="stock-info">Disponibles: ${p.stock}</div>
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

// --- CARRITO Y COMPRA ---
function agregarCarrito(id) {
    const prod = productos.find(p => p.id === id);
    // Verificar si ya está en carrito y si hay stock suficiente
    const enCarrito = carrito.find(item => item.id === id);
    const cantidadActual = enCarrito ? enCarrito.cantidad : 0;

    if (cantidadActual >= prod.stock) {
        alert("¡No hay más stock disponible!");
        return;
    }

    if (enCarrito) {
        enCarrito.cantidad++;
    } else {
        carrito.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
    }
    actualizarUI();
}

function actualizarUI() {
    document.getElementById('count').innerText = carrito.reduce((acc, item) => acc + item.cantidad, 0);
}

function abrirCarrito() {
    const lista = document.getElementById('lista-carrito');
    lista.innerHTML = '';
    let total = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        lista.innerHTML += `
            <div class="cart-item">
                <span>${item.cantidad}x ${item.nombre}</span>
                <span>$${subtotal.toFixed(2)} 
                    <button style="margin-left:5px; color:red;" onclick="eliminarItem(${index})">X</button>
                </span>
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
        body: JSON.stringify({ carrito, cliente: "Cliente Tienda" })
    });

    const data = await res.json();
    if (data.success) {
        alert("¡Compra exitosa! Imprimiendo ticket...");
        imprimirTicket(data.pedidoId, data.total);
        carrito = []; // Vaciar carrito
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
    CANT  PRODUCTO          PRECIO
    --------------------------------
    `;
    carrito.forEach(item => {
        ticket += `${item.cantidad}x   ${item.nombre.substring(0,15).padEnd(15)} $${(item.precio * item.cantidad).toFixed(2)}\n`;
    });
    ticket += `
    --------------------------------
    TOTAL A PAGAR:      $${total}
    ================================
    ¡Gracias por su compra!
    `;
    
    // Crear ventana de impresión
    const ventana = window.open('', '', 'width=400,height=600');
    ventana.document.write('<pre style="font-family: monospace;">' + ticket + '</pre>');
    ventana.document.close();
    ventana.print();
}

// --- FUNCIONES DE ADMIN ---
function toggleLogin() { document.getElementById('modal-login').style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if ((await res.json()).success) {
        esAdmin = true;
        document.getElementById('admin-bar').style.display = 'block';
        cerrarModal('modal-login');
        renderizarProductos(); // Volver a pintar con botones de editar
    } else {
        alert("Credenciales incorrectas");
    }
}

function logout() {
    esAdmin = false;
    document.getElementById('admin-bar').style.display = 'none';
    renderizarProductos();
}

// CRUD Admin
let editandoId = null;

function abrirModalProducto() {
    editandoId = null; // Modo crear
    document.getElementById('titulo-modal-prod').innerText = "Nuevo Producto";
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-img').value = '';
    document.getElementById('prod-cat').value = '';
    document.getElementById('modal-producto').style.display = 'flex';
}

function editarProducto(id) {
    const p = productos.find(x => x.id === id);
    editandoId = id; // Modo editar
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

    const url = editandoId ? `/api/admin/productos/${editandoId}` : '/api/admin/productos';
    const method = editandoId ? 'PUT' : 'POST';

    await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });

    cerrarModal('modal-producto');
    cargarProductos();
}

async function borrarProducto(id) {
    if (!confirm("¿Seguro que quieres borrar este producto?")) return;
    await fetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
    cargarProductos();
}