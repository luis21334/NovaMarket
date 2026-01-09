let carrito = [];
let productos = [];
let esAdmin = false;
let chartInstance = null; // Instancia de la gráfica

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    checkDarkMode();
});

// --- MODO OSCURO ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode'));
}
function checkDarkMode() {
    if(localStorage.getItem('dark-mode') === 'true') document.body.classList.add('dark-mode');
}

// --- PRODUCTOS ---
async function cargarProductos() {
    try {
        const res = await fetch('/api/productos');
        productos = await res.json();
        generarBotonesCategorias();
        renderizarProductos(productos);
    } catch (e) { console.error("Error:", e); }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';
    
    if(lista.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center">No se encontraron productos.</p>';
        return;
    }

    lista.forEach(p => {
        // Controles de Admin (Editar/Borrar)
        const adminHtml = esAdmin ? `
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <button onclick="editarProducto(${p.id})" class="btn-info" style="font-size:0.8rem; padding:5px 10px;">✏️ Editar</button>
                <button onclick="borrarProducto(${p.id})" class="btn-danger" style="font-size:0.8rem; padding:5px 10px;">🗑️ Borrar</button>
            </div>` : '';

        // Botón de Compra
        const btnCompra = p.stock > 0 
            ? `<button class="btn-accent full-width" onclick="agregarCarrito(${p.id})">Agregar al Carrito</button>`
            : `<button class="btn-secondary full-width" disabled style="opacity:0.6">Agotado</button>`;

        grid.innerHTML += `
            <div class="card">
                <img src="${p.imagen_url}" onerror="this.src='https://via.placeholder.com/300?text=Sin+Imagen'">
                <div class="card-body">
                    <div>
                        <span class="card-cat">${p.categoria || 'Varios'}</span>
                        <h3>${p.nombre}</h3>
                        <div class="card-price">$${p.precio}</div>
                        <small style="color:${p.stock<5?'#e74c3c':'#27ae60'}">Stock: ${p.stock}</small>
                    </div>
                    <div style="margin-top:10px;">
                        ${adminHtml}
                        ${btnCompra}
                    </div>
                </div>
            </div>
        `;
    });
}

// --- FILTROS ---
function generarBotonesCategorias() {
    const cont = document.getElementById('filtros-categorias');
    const cats = ['Todas', ...new Set(productos.map(p => p.categoria || 'Otros'))];
    cont.innerHTML = '';
    cats.forEach(c => {
        cont.innerHTML += `<button onclick="filtrarCat('${c}', this)" class="${c==='Todas'?'active':''}">${c}</button>`;
    });
}

function filtrarCat(cat, btn) {
    document.querySelectorAll('.cat-filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtrados = cat === 'Todas' ? productos : productos.filter(p => (p.categoria||'Otros') === cat);
    renderizarProductos(filtrados);
}

function filtrarProductos() {
    const txt = document.getElementById('buscador').value.toLowerCase();
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(txt));
    renderizarProductos(filtrados);
}

// --- CARRITO ---
function agregarCarrito(id) {
    const prod = productos.find(p => p.id === id);
    const item = carrito.find(i => i.id === id);

    if (item) {
        if (item.cantidad >= prod.stock) return alert("¡No puedes agregar más de lo que hay en stock!");
        item.cantidad++;
    } else {
        carrito.push({ ...prod, cantidad: 1 });
    }
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    const count = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    // Actualizar Badges y Textos
    document.getElementById('badge-count').innerText = count;
    document.getElementById('items-count').innerText = count;
    document.getElementById('total-carrito').innerText = total.toFixed(2);
    document.getElementById('checkout-total').innerText = total.toFixed(2);

    // Renderizar Lista
    const lista = document.getElementById('lista-carrito');
    lista.innerHTML = '';
    
    if(carrito.length === 0) lista.innerHTML = '<p style="text-align:center">Carrito vacío.</p>';

    carrito.forEach((item, idx) => {
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:8px 0;">
                <div>
                    <strong>${item.nombre}</strong><br>
                    <small>${item.cantidad} x $${item.precio}</small>
                </div>
                <div style="text-align:right">
                    <strong>$${(item.cantidad * item.precio).toFixed(2)}</strong><br>
                    <button onclick="eliminarDelCarrito(${idx})" style="color:#e74c3c; background:none; padding:0; font-size:0.8rem;">Eliminar</button>
                </div>
            </div>
        `;
    });
}

function eliminarDelCarrito(idx) {
    carrito.splice(idx, 1);
    actualizarCarritoUI();
}

function abrirCarrito() {
    document.getElementById('modal-carrito').style.display = 'flex';
}

// --- CHECKOUT (SIMULACIÓN DE PAGO) ---
function iniciarCheckout() {
    if(carrito.length === 0) return alert("El carrito está vacío");
    document.getElementById('modal-carrito').style.display = 'none';
    
    // Resetear Estado del Modal Checkout
    document.getElementById('checkout-form-view').style.display = 'block';
    document.getElementById('checkout-loading').style.display = 'none';
    document.getElementById('modal-checkout').style.display = 'flex';
}

function setMetodo(tipo) {
    document.getElementById('form-tarjeta').style.display = (tipo === 'tarjeta') ? 'flex' : 'none';
    document.getElementById('info-caja').style.display = (tipo === 'caja') ? 'block' : 'none';
}

function procesarPago() {
    // 1. Ocultar formulario y mostrar carga
    document.getElementById('checkout-form-view').style.display = 'none';
    document.getElementById('checkout-loading').style.display = 'block';

    // 2. Simular espera de 2.5 segundos
    setTimeout(async () => {
        const metodo = document.querySelector('input[name="pago"]:checked').value;
        
        // 3. Enviar al Servidor
        const res = await fetch('/api/comprar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ carrito, metodoPago: metodo })
        });

        const data = await res.json();

        if (data.success) {
            imprimirTicket(data.pedidoId, data.total, metodo);
            carrito = [];
            actualizarCarritoUI();
            cargarProductos(); // Refrescar stock visualmente
            cerrarModal('modal-checkout');
        } else {
            alert("Error: " + data.error);
            iniciarCheckout(); // Regresar si falló
        }
    }, 2500); 
}

function imprimirTicket(id, total, metodo) {
    const fecha = new Date().toLocaleString();
    let ticket = `
    🧾 TICKET DE COMPRA - NOVAMARKET
    ================================
    Orden:  #${id}
    Fecha:  ${fecha}
    Método: ${metodo.toUpperCase()}
    --------------------------------
    CANT  PRODUCTO          TOTAL
    --------------------------------
    `;
    carrito.forEach(i => {
        ticket += `${i.cantidad} x ${i.nombre.substring(0,15)}... $${(i.precio*i.cantidad).toFixed(2)}\n`;
    });
    ticket += `
    --------------------------------
    TOTAL PAGADO:      $${total}
    ================================
    ¡Gracias por tu compra!
    `;
    
    const win = window.open('', '', 'width=350,height=500');
    win.document.write('<pre style="font-family:monospace">' + ticket + '</pre>');
    win.print();
}


// --- DASHBOARD Y ADMIN ---
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    
    const res = await fetch('/api/login', {
        method: 'POST', 
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email, password})
    });
    const data = await res.json();

    if(data.success) {
        esAdmin = true;
        document.getElementById('admin-bar').style.display = 'flex';
        cerrarModal('modal-login');
        renderizarProductos(productos); // Reactivar botones admin
        actualizarBadgeGerente();
    } else {
        document.getElementById('msg-error').style.display = 'block';
    }
}

async function actualizarBadgeGerente() {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    document.getElementById('admin-ventas-total').innerText = `$${parseFloat(data.ingresos).toFixed(2)}`;
}

async function abrirDashboard() {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    document.getElementById('dash-ingresos').innerText = `$${parseFloat(data.ingresos).toFixed(2)}`;
    document.getElementById('dash-ventas').innerText = data.ventas;
    document.getElementById('dash-stock').innerText = data.stockBajo;

    // Configurar Gráfica con Chart.js
    const ctx = document.getElementById('ventasChart').getContext('2d');
    
    if(chartInstance) chartInstance.destroy(); // Destruir anterior si existe

    const labels = data.topProductos.map(p => p.nombre.split(' ')[0]); // Solo primer nombre
    const valores = data.topProductos.map(p => p.vendidos);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: valores,
                backgroundColor: ['#e67e22', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f'],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });

    document.getElementById('modal-dashboard').style.display = 'flex';
}

// --- UTILIDADES ---
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }
function toggleLogin() { document.getElementById('modal-login').style.display = 'flex'; }
function logout() { location.reload(); } // Recargar página para cerrar sesión

// CRUD Productos (Simplificado para conectar con HTML)
let editId = null;
function abrirModalProducto() { editId=null; document.getElementById('titulo-modal-prod').innerText='Nuevo Producto'; document.getElementById('modal-producto').style.display='flex'; limpiarForm(); }
function editarProducto(id) { 
    const p = productos.find(x => x.id == id); editId = id;
    document.getElementById('titulo-modal-prod').innerText='Editar Producto';
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-cat').value = p.categoria;
    document.getElementById('prod-img').value = p.imagen_url;
    document.getElementById('modal-producto').style.display = 'flex';
}
function limpiarForm() { 
    document.getElementById('prod-nombre').value=''; document.getElementById('prod-precio').value='';
    document.getElementById('prod-stock').value=''; document.getElementById('prod-cat').value=''; document.getElementById('prod-img').value=''; 
}

async function guardarProducto() {
    const body = {
        nombre: document.getElementById('prod-nombre').value,
        precio: document.getElementById('prod-precio').value,
        stock: document.getElementById('prod-stock').value,
        categoria: document.getElementById('prod-cat').value,
        imagen_url: document.getElementById('prod-img').value
    };

    const url = editId ? `/api/admin/productos/${editId}` : '/api/admin/productos';
    const method = editId ? 'PUT' : 'POST';

    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    cerrarModal('modal-producto');
    cargarProductos();
}

async function borrarProducto(id) {
    if(confirm('¿Seguro que quieres borrar este producto?')) {
        await fetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
        cargarProductos();
    }
}