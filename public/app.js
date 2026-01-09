let carrito = [];
let productos = [];
let usuarioActual = null;
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    checkDarkMode();
    const userStored = localStorage.getItem('novaUser');
    if(userStored) setUsuario(JSON.parse(userStored));
});


function setUsuario(user) {
    usuarioActual = user;
    localStorage.setItem('novaUser', JSON.stringify(user));
    
    document.getElementById('btn-login-main').style.display = 'none';
    document.getElementById('btn-logout-main').style.display = 'block';
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('user-name').innerText = user.nombre;
    document.getElementById('user-role').innerText = user.rol === 'admin' ? 'Gerente' : 'Cliente';

    if (user.rol === 'admin') {
        document.getElementById('admin-bar').style.display = 'flex';
        actualizarStatsAdmin();
    }
    renderizarProductos(productos);
}

function logout() {
    usuarioActual = null;
    localStorage.removeItem('novaUser');
    location.reload();
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const res = await fetch('/api/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email, password})
    });
    const data = await res.json();
    if(data.success) {
        setUsuario(data.user);
        cerrarModal('modal-login');
    } else {
        document.getElementById('msg-error').style.display = 'block';
    }
}

function toggleRegistro() {
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-registro');
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block'; regForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none'; regForm.style.display = 'block';
    }
}

async function registrarCliente() {
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;

    if(!nombre || !email || !password) return alert("Llena todos los campos");

    const res = await fetch('/api/registro', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({nombre, email, password})
    });
    const data = await res.json();
    if(data.success) {
        alert("Registro exitoso. Inicia sesión.");
        toggleRegistro();
    } else {
        alert(data.message || "Error");
    }
}


async function cargarProductos() {
    try {
        const res = await fetch('/api/productos');
        productos = await res.json();
        generarCategorias();
        renderizarProductos(productos);
    } catch(e) { console.error(e); }
}

function renderizarProductos(lista) {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

    lista.forEach(p => {
        const adminHtml = esAdmin ? `
            <div style="margin-bottom:10px; display:flex; gap:5px;">
                <button onclick="editarProducto(${p.id})" class="btn-info" style="font-size:0.8rem; padding:5px;">✏️</button>
                <button onclick="borrarProducto(${p.id})" class="btn-danger" style="font-size:0.8rem; padding:5px;">🗑️</button>
            </div>` : '';
        
        const btnCompra = p.stock > 0 
            ? `<button class="btn-accent full-width" onclick="agregarCarrito(${p.id})">Agregar</button>`
            : `<button class="btn-secondary full-width" disabled>Agotado</button>`;

        grid.innerHTML += `
            <div class="card">
                <img src="${p.imagen_url}" onerror="this.src='https://via.placeholder.com/300'">
                <div class="card-body">
                    <div>
                        <small style="opacity:0.7">${p.categoria||'Varios'}</small>
                        <h3>${p.nombre}</h3>
                        <div class="card-price">$${p.precio}</div>
                        <small style="color:${p.stock<5?'red':'green'}">Stock: ${p.stock}</small>
                    </div>
                    <div style="margin-top:10px;">${adminHtml}${btnCompra}</div>
                </div>
            </div>`;
    });
}


function agregarCarrito(id) {
    const p = productos.find(x=>x.id==id);
    const item = carrito.find(x=>x.id==id);
    if(item) { if(item.cantidad>=p.stock) return alert('Sin stock'); item.cantidad++; }
    else carrito.push({...p, cantidad:1});
    updateCartUI();
}

function updateCartUI() {
    const count = carrito.reduce((a,b)=>a+b.cantidad,0);
    const total = carrito.reduce((a,b)=>a+(b.precio*b.cantidad),0);
    document.getElementById('badge-count').innerText=count;
    document.getElementById('total-carrito').innerText=total.toFixed(2);
    
    const list = document.getElementById('lista-carrito');
    list.innerHTML = carrito.length ? '' : '<p align="center">Vacío</p>';
    carrito.forEach((i, idx)=> {
        list.innerHTML+=`<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;">
            <span>${i.cantidad}x ${i.nombre}</span><span>$${(i.precio*i.cantidad).toFixed(2)} 
            <button onclick="carrito.splice(${idx},1);updateCartUI()" style="color:red; background:none; padding:0;">✕</button></span></div>`;
    });
}

function abrirCarrito() {
    document.getElementById('modal-carrito').style.display='flex';
}

function iniciarCheckout() {
    if(!usuarioActual) return alert("Debes iniciar sesión para comprar.");
    if(!carrito.length) return alert("Carrito vacío");
    document.getElementById('modal-carrito').style.display='none';
    document.getElementById('modal-checkout').style.display='flex';
    document.getElementById('checkout-form-view').style.display='block';
    document.getElementById('checkout-loading').style.display='none';
}

function setMetodo(m) {
    document.getElementById('form-tarjeta').style.display = m==='tarjeta'?'flex':'none';
    document.getElementById('info-caja').style.display = m==='caja'?'block':'none';
}

function procesarPago() {
    document.getElementById('checkout-form-view').style.display='none';
    document.getElementById('checkout-loading').style.display='block';
    setTimeout(async () => {
        const metodo = document.querySelector('input[name="pago"]:checked').value;
        const res = await fetch('/api/comprar', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                carrito, 
                cliente: usuarioActual.nombre, 
                email: usuarioActual.email, 
                metodoPago: metodo
            })
        });
        const data = await res.json();
        if(data.success) {
            imprimirTicket(data.pedidoId, data.total, metodo);
            carrito=[]; updateCartUI(); cargarProductos();
            if(usuarioActual.rol === 'admin') actualizarStatsAdmin();
            cerrarModal('modal-checkout');
        } else alert(data.error);
    }, 2000);
}

function imprimirTicket(id, total, metodo) {
    const win = window.open('','','width=350,height=500');
    let t = `🧾 NOVAMARKET\nPedido: #${id}\nCliente: ${usuarioActual.nombre}\nMétodo: ${metodo.toUpperCase()}\n----------------\n`;
    carrito.forEach(i=>t+=`${i.cantidad}x ${i.nombre.substr(0,15)}.. $${(i.precio*i.cantidad).toFixed(2)}\n`);
    t+=`----------------\nTOTAL: $${total}\n¡Gracias!`;
    win.document.write(`<pre>${t}</pre>`); win.print();
}


function verTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(d=>d.style.display='none');
    document.querySelectorAll('.tab-link').forEach(b=>b.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).style.display='block';
    if(event) event.target.classList.add('active');
    
    if(tabName === 'cortes') llenarHistorialCortes();
    if(tabName === 'clientes') cargarClientesAdmin();
}

async function actualizarStatsAdmin() {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    document.getElementById('admin-ventas-hoy').innerText = `$${parseFloat(data.corteActual).toFixed(2)}`;
    document.getElementById('dash-corte').innerText = `$${parseFloat(data.corteActual).toFixed(2)}`;
    document.getElementById('dash-ingresos').innerText = `$${parseFloat(data.ingresosTotales).toFixed(2)}`;
    document.getElementById('dash-stock').innerText = data.stockBajo;
    
    const ctx = document.getElementById('ventasChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type:'bar', data:{labels:data.topProductos.map(p=>p.nombre.split(' ')[0]), datasets:[{label:'Top Ventas', data:data.topProductos.map(p=>p.vendidos), backgroundColor:'#e67e22'}]}
    });
}

async function hacerCorteCaja() {
    const totalTxt = document.getElementById('dash-corte').innerText.replace('$','');
    const total = parseFloat(totalTxt);
    if(total === 0) return alert("Turno en ceros.");
    if(!confirm(`¿Cerrar turno por $${total}?`)) return;

    const res = await fetch('/api/admin/corte', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({usuario: usuarioActual.nombre, total})
    });
    const data = await res.json();
    if(data.success) {
        alert("Corte realizado.");
        actualizarStatsAdmin();
    }
}

async function llenarHistorialCortes() {
    const res = await fetch('/api/admin/historial-cortes');
    const lista = await res.json();
    const tbody = document.getElementById('lista-cortes-history');
    tbody.innerHTML = lista.map(c => `<tr><td>${new Date(c.fecha).toLocaleString()}</td><td>${c.usuario}</td><td style="color:green;font-weight:bold">$${c.total}</td></tr>`).join('');
}

async function cargarClientesAdmin() {
    const res = await fetch('/api/admin/clientes');
    const lista = await res.json();
    const tbody = document.getElementById('lista-clientes-admin');
    tbody.innerHTML = lista.map(c => `
        <tr><td>${c.nombre}</td><td>${c.email}</td>
        <td><button class="btn-info" onclick="verHistorial('${c.email}')">Historial</button> 
        <button class="btn-danger" onclick="bajaCliente(${c.id})">Baja</button></td></tr>
    `).join('');
}

async function verHistorial(email) {
    document.getElementById('hist-email').innerText = email;
    const res = await fetch(`/api/admin/historial/${email}`);
    const pedidos = await res.json();
    const cont = document.getElementById('hist-lista');
    cont.innerHTML = pedidos.length ? pedidos.map(p => `<div style="padding:10px; border-bottom:1px solid #eee;"><strong>#${p.id}</strong> - ${new Date(p.fecha).toLocaleDateString()} - $${p.total}</div>`).join('') : '<p style="padding:10px">Sin compras.</p>';
    document.getElementById('modal-historial').style.display='flex';
}

async function bajaCliente(id) { if(confirm("¿Eliminar?")) { await fetch(`/api/admin/clientes/${id}`, {method:'DELETE'}); cargarClientesAdmin(); } }
function abrirDashboard() { actualizarStatsAdmin(); verTab('resumen'); document.getElementById('modal-dashboard').style.display='flex'; }

// Helpers
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode')); }
function checkDarkMode() { if(localStorage.getItem('dark-mode')==='true') document.body.classList.add('dark-mode'); }
function cerrarModal(id) { document.getElementById(id).style.display='none'; }
function toggleLogin() { document.getElementById('modal-login').style.display='flex'; }
function generarCategorias() { const cont = document.getElementById('filtros-categorias'); const cats = ['Todas', ...new Set(productos.map(p=>p.categoria||'Otros'))]; cont.innerHTML = ''; cats.forEach(c => cont.innerHTML+=`<button onclick="filtrar('${c}', this)" class="${c==='Todas'?'active':''}">${c}</button>`); }
function filtrar(cat, btn) { document.querySelectorAll('.cat-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderizarProductos(cat==='Todas'?productos:productos.filter(p=>(p.categoria||'Otros')===cat)); }
function filtrarProductos() { const txt = document.getElementById('buscador').value.toLowerCase(); renderizarProductos(productos.filter(p=>p.nombre.toLowerCase().includes(txt))); }

// CRUD Prod
let editId = null;

function abrirModalProducto() {
    editId = null;
    
    if(document.getElementById('titulo-modal-prod')) {
        document.getElementById('titulo-modal-prod').innerText = 'Nuevo Producto';
    }

    
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-cat').value = '';
    document.getElementById('prod-img').value = '';

    document.getElementById('modal-producto').style.display = 'flex';
}

function editarProducto(id) {
    const p = productos.find(x => x.id == id);
    editId = id;
    if(document.getElementById('titulo-modal-prod')) {
        document.getElementById('titulo-modal-prod').innerText = 'Editar Producto';
    }
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-cat').value = p.categoria;
    document.getElementById('prod-img').value = p.imagen_url;
    document.getElementById('modal-producto').style.display = 'flex';
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
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    cerrarModal('modal-producto');
    cargarProductos();
}

async function borrarProducto(id) {
    if (confirm('¿Borrar?')) {
        await fetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
        cargarProductos();
    }
}