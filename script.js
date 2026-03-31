
// Funções de suporte para renderização
function renderSalesChart(dailySales) {
  const container = document.getElementById('sales-chart');
  const maxValue = Math.max(...dailySales.map(d => d.value), 1);
  
  container.innerHTML = dailySales.map(day => {
    const height = (day.value / maxValue) * 100;
    return `
      <div class="bar-item">
        <div class="bar" style="height: ${Math.max(height, 5)}%"></div>
        <span class="bar-label">${day.label}</span>
      </div>`;
  }).join('');
}

function renderLowStockList(products) {
  const container = document.getElementById('low-stock-list');
  if (!products || products.length === 0) {
    container.innerHTML = '<p class="text-muted">Stock em conformidade.</p>';
    return;
  }
  container.innerHTML = products.map(p => `
    <div class="cart-item">
      <span>${p.nome}</span>
      <span class="badge badge-danger">${p.stock} un.</span>
    </div>
  `).join('');
}

// Variável global para o filtro atual
let currentDays = 7;

// Função para mudar o filtro (chamada pelos botões onclick da sua seção)
async function setDashboardFilter(days) {
  currentDays = days;
  
  // Atualiza visual dos botões
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', parseInt(chip.dataset.days) === days);
  });
  
  await updateDashboard();
}



// Chamar automaticamente quando a aba dashboard for clicada no menu
// (Adicione isso na sua função de troca de abas existente)

// Abrir o modal
function showProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.classList.add('active'); // Usa a classe do seu CSS
    // Foca no primeiro campo para facilitar o uso
    setTimeout(() => document.getElementById('product-code').focus(), 100);
  }
}

// Fechar o modal
function hideProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.classList.remove('active');
    document.getElementById('product-form').reset();
  }
}


/***********************
 * DATABASE INIT
 ***********************/
const DB_NAME = "pos_offline_db";
const DB_VERSION = 1;
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      if (!db.objectStoreNames.contains("products")) {
        const store = db.createObjectStore("products", { keyPath: "codigo" });
        store.createIndex("nome", "nome", { unique: false });
      }

      if (!db.objectStoreNames.contains("sales")) {
        const store = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
        store.createIndex("date", "date", { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };

    request.onerror = () => reject("Erro DB");
  });
}

/***********************
 * DATABASE API (CRUD)
 ***********************/
window.POS_DB = {

  async addOrUpdateProduct(product) {
    const tx = db.transaction("products", "readwrite");
    tx.objectStore("products").put(product);
  },

  async deleteProduct(code) {
    const tx = db.transaction("products", "readwrite");
    tx.objectStore("products").delete(code);
  },

  async getProducts() {
    return new Promise(resolve => {
      const req = db.transaction("products").objectStore("products").getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  async getProductByCode(code) {
    return new Promise(resolve => {
      const req = db.transaction("products").objectStore("products").get(code);
      req.onsuccess = () => resolve(req.result);
    });
  },

  async saveSale(sale) {
    const tx = db.transaction("sales", "readwrite");
    tx.objectStore("sales").add(sale);
  },

  async getSales() {
    return new Promise(resolve => {
      const req = db.transaction("sales").objectStore("sales").getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  formatCurrency(v) {
    return `${(v || 0).toFixed(2)} Kz`;
  },

  async getSalesAnalytics() {
    const sales = await this.getSales();
    const products = await this.getProducts();

    let total = 0;
    let produtosVendidos = 0;

    sales.forEach(s => {
      total += s.total;
      s.items.forEach(i => produtosVendidos += i.qtd);
    });

    const lowStock = products.filter(p => p.stock <= 5);

    return {
      totalVendas: total,
      numeroVendas: sales.length,
      produtosVendidos,
      ticketMedio: sales.length ? total / sales.length : 0,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock
    };
  }
};

/***********************
 * NAVIGATION
 ***********************/
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.section;

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${target}`).classList.add('active');

    if (target === "dashboard") updateDashboard();
    if (target === "historico") renderSalesHistory();
  });
});

/***********************
 * PRODUCTS (CRUD)
 ***********************/
async function renderProducts() {
  const products = await POS_DB.getProducts();
  const tbody = document.getElementById('products-table-body');

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.codigo}</td>
      <td>${p.nome}</td>
      <td>${POS_DB.formatCurrency(p.preco)}</td>
       <td class="${p.stock <= 5 ? 'stock-low' : 'stock-ok'}">${p.stock}</td>
      <td>
        <button onclick="editProduct('${p.codigo}')" class="btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
        </button>
        <button onclick="deleteProduct('${p.codigo}')" class="btn btn-danger">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
        </button>
      </td>
    </tr>
  `).join('');
}



/***********************
 * CART
 ***********************/
let cart = [];

async function addToCart(code) {
  const product = await POS_DB.getProductByCode(code);
  Dialog.innerHTML=`
   <p>Produto não encontrado</p>
     <br>
  <div class="dialog-buttons">
    <button class="btn btn-primary" onclick="Dialog.close()">Ok</button>
      </div>
  `;
  if (!product) return Dialog.showModal();

  const item = cart.find(i => i.codigo === code);

  if (item) item.qtd++;
  else cart.push({ ...product, qtd: 1 });

  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  const badge = document.getElementById('cart-badge');

  if (!cart.length) {
    container.innerHTML = "<p>Carrinho vazio</p>";
    summary.innerHTML = "";
    badge.style.display = "none";
    document.getElementById('checkout-btn').disabled = true;
    return;
  }

  let total = 0, count = 0;

  container.innerHTML = cart.map(item => {
    const sub = item.preco * item.qtd;
    total += sub;
    count += item.qtd;

    return `
      <div class="cart-item">
        <div>${item.nome}</div>
        <div>${item.qtd} x ${POS_DB.formatCurrency(item.preco)}</div>
        <div>${POS_DB.formatCurrency(sub)}</div>
      </div>
    `;
  }).join('');

  summary.innerHTML = `<div class="cart-summary-row total">Total: ${POS_DB.formatCurrency(total)}</div>`;
  badge.style.display = "inline-block";
  badge.textContent = count;
  document.getElementById('checkout-btn').disabled = false;
}

document.getElementById('product-search').addEventListener('input', async (e) => {
  const term = e.target.value.toLowerCase();
  const products = await POS_DB.getProducts();
  const filtered = products.filter(p => 
    p.nome.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term)
  );
  
  // Reutiliza a lógica de renderização com a lista filtrada
  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.codigo}</td>
      <td>${p.nome}</td>
      <td>${POS_DB.formatCurrency(p.preco)}</td>
      <td class="${p.stock <= 5 ? 'stock-low' : 'stock-ok'}">${p.stock}</td>
      <td>
       <button onclick="editProduct('${p.codigo}')" class="btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
        </button>
        <button onclick="deleteProduct('${p.codigo}')" class="btn btn-danger">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
        </button>
      </td>
    </tr>
  `).join('');
});
// Adicione estas funções ao seu script.js

// Salvar novo produto ou atualizar existente
async function saveNewProduct() {
  const codigo = document.getElementById('product-code').value;
  const nome = document.getElementById('product-name').value;
  const preco = parseFloat(document.getElementById('product-price').value) || 0;
  const stock = parseInt(document.getElementById('product-stock').value) || 0;

  Dialog.innerHTML= `
  <p>O nome do produto é obrigatório</p>
     <br>
  <div class="dialog-buttons">
    <button class="btn btn-primary" onclick="Dialog.close()">Ok</button>
      </div>
  `;
  if (!nome) return Dialog.showModal()

  const product = { codigo, nome, preco, stock };
  
  await POS_DB.addOrUpdateProduct(product);
  hideProductModal();
  renderProducts();
  
  // Limpa o formulário para o próximo
  document.getElementById('product-form').reset();
}

// Editar Produto (Preenche o modal)
async function editProduct(code) {
  const p = await POS_DB.getProductByCode(code);
  if (p) {
    document.getElementById('product-code').value = p.codigo;
    document.getElementById('product-name').value = p.nome;
    document.getElementById('product-price').value = p.preco;
    document.getElementById('product-stock').value = p.stock;
    
    document.querySelector('.modal-title').textContent = "Editar Produto";
    showProductModal();
  }
}

// Eliminar Produto
async function deleteProduct(code) {
  Dialog.innerHTML = `
  <p>Tem a certeza que deseja eliminar o produto ${code}?</p>

  <div class="dialog-buttons">
    <button class="btn btn-secondary" onclick="Dialog.close()">Cancelar</button>
    <button class="btn btn-primary" onclick="
  await POS_DB.deleteProduct(code);
    renderProducts();
    Dialog.close();
  ">Eliminar</button>
  </div>  `
  Dialog.showModal();
}

/***********************
 * CHECKOUT
 ***********************/
async function checkout() {
  if (!cart.length) return;

  const total = cart.reduce((sum, i) => sum + i.preco * i.qtd, 0);

  for (const item of cart) {
    const p = await POS_DB.getProductByCode(item.codigo);
    if (p) {
      p.stock = Math.max(0, p.stock - item.qtd);
      await POS_DB.addOrUpdateProduct(p);
    }
  }

  await POS_DB.saveSale({
    date: new Date(),
    items: cart,
    total
  });

  Dialog.innerHTML= `
  <p>Venda concluída!</p>
     <br>
  <div class="dialog-buttons">
    <button class="btn btn-primary" onclick="Dialog.close()">Ok</button>
      </div>
  `;
  Dialog.showModal();

  cart = [];
  renderCart();
  renderProducts();
  renderSalesHistory();
}

/***********************
 * SALES HISTORY
 ***********************/
async function renderSalesHistory() {
  const container = document.getElementById("sales-history");
  const sales = await POS_DB.getSales();

  if (!sales.length) {
    container.innerHTML = "<p>Nenhuma venda ainda</p>";
    return;
  }

  container.innerHTML = sales.map(s => `
    <div class="card mb-md">
      <div><strong>Data:</strong> ${new Date(s.date).toLocaleString()}</div>
      <div><strong>Total:</strong> ${POS_DB.formatCurrency(s.total)}</div>
      <div><strong>Itens:</strong> ${s.items.length}</div>
    </div>
  `).join('');
}

/***********************
 * DASHBOARD
 ***********************/
let dashboardDays = 7;

async function updateDashboard() {
  const a = await POS_DB.getSalesAnalytics();

  document.getElementById('metric-total-vendas').textContent = POS_DB.formatCurrency(a.totalVendas);
  document.getElementById('metric-numero-vendas').textContent = a.numeroVendas;
  document.getElementById('metric-produtos-vendidos').textContent = a.produtosVendidos;
  document.getElementById('metric-low-stock').textContent = a.lowStockCount;
  document.getElementById('metric-ticket-medio').textContent = POS_DB.formatCurrency(a.ticketMedio);

  document.getElementById('low-stock-list').innerHTML =
    a.lowStockProducts.map(p => `<div>${p.nome} (${p.stock})</div>`).join('');
}

/***********************
 * EVENTS
 ***********************/
document.getElementById('checkout-btn').addEventListener('click', checkout);
document.getElementById('clear-cart-btn').addEventListener('click', () => { cart = []; renderCart(); });
document.getElementById('manual-code-btn').addEventListener('click', () => addToCart(document.getElementById('manual-code-input').value));

/***********************
 * SCANNER (ADAPTADO)
 ***********************/
let html5QrCode;
let lastResult = null;
let isScanning = false;

async function toggleScanner() {
  const btn = document.getElementById('scanner-toggle');
  const placeholder = document.getElementById('scanner-placeholder');
  const scannerLine = document.getElementById('scanner-line');
  const flash = document.getElementById('scanner-flash');

  if (!isScanning) {
    // Iniciar Scanner
    html5QrCode = new Html5Qrcode("scanner-reader");
    placeholder.style.display = "none";
    scannerLine.style.display = "block";

    try {
      const cameras = await Html5Qrcode.getCameras();

      if (!cameras || cameras.length === 0) {
        Dialog.innerHTML= `
          <p>Nenhuma câmara encontrada</p>
     <br>
  <div class="dialog-buttons">
    <button class="btn btn-primary" onclick="Dialog.close()">Ok</button>
      </div>
        `;
        Dialog.showModal();
        return;
      }

      // Tenta encontrar a câmera traseira
      const cameraId = cameras.find(cam =>
        cam.label.toLowerCase().includes("back") ||
        cam.label.toLowerCase().includes("traseira")
      )?.id || cameras[0].id;

      await html5QrCode.start(
        cameraId,
        {
          fps: 15, // Aumentado para maior fluidez
          qrbox: { width: 250, height: 150 }
        },
        (decodedText) => {
          // Evitar repetir a mesma leitura seguida rapidamente
          if (decodedText === lastResult) return;
          lastResult = decodedText;

          // Feedback visual de leitura (Flash)
          flash.style.opacity = "1";
          setTimeout(() => flash.style.opacity = "0", 200);

          // Adiciona ao carrinho usando a função existente
          addToCart(decodedText);
          
          // Opcional: Notificação visual
          console.log("Lido:", decodedText);
          
          // Reset do lastResult após 2 segundos para permitir ler o mesmo item de novo
          setTimeout(() => { lastResult = null; }, 2000);
        },
        (error) => {
          // Erros de leitura ignorados para não poluir o console
        }
      );

      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
        Parar Scanner`;
      btn.classList.replace('btn-primary', 'btn-danger');
      isScanning = true;
      Dialog.innerHTML= `
      <p>Erro ao acessar a câmera. Certifique-se que deu permissão!</p>
     <br>
  <div class="dialog-buttons">
    <button class="btn btn-primary" onclick="Dialog.close()">Ok</button>
      </div>
      `;

    } catch (err) {
      console.error(err);
      Dialog.showModal();
      placeholder.style.display = "flex";
      scannerLine.style.display = "none";
    }
  } else {
    // Parar Scanner
    if (html5QrCode) {
      await html5QrCode.stop();
      html5QrCode.clear();
    }
    
    placeholder.style.display = "flex";
    scannerLine.style.display = "none";
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
      Iniciar Scanner`;
    btn.classList.replace('btn-danger', 'btn-primary');
    isScanning = false;
  }
}

// Event Listener para o botão do seu HTML
document.getElementById('scanner-toggle').addEventListener('click', toggleScanner);


/***********************
 * INIT
 ***********************/
document.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  renderProducts();
});