let products = [];
let editingId = null;

async function loadProducts() {
  const res = await fetch("https://fakestoreapi.com/products");
  products = await res.json();

  displayProducts(products);
}

loadProducts();

function displayProducts(products) {
  const container = document.getElementById("products");

  container.innerHTML = products
    .map( (p) => ` <div class="product-card">
     <img src="${p.image}" width="100">
     <h3>${p.title}</h3>
      <p>$${p.price}</p>
      <div class="product-actions">
      <button class="btn btn-edit" onclick="openEdit(${p.id})">Edit</button>
      <button class="btn btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
       </div>
       </div>`, )  .join("");
}

function showForm() {
  editingId = null;

  document.getElementById("form-title").textContent = "Add Product";

  document.getElementById("prod-title").value = "";
  document.getElementById("prod-price").value = "";
  document.getElementById("prod-desc").value = "";
  document.getElementById("prod-image").value = "";

  document.getElementById("product-form").style.display = "flex";
  document.getElementById("overlay").style.display = "block";
}

function closeForm() {
  document.getElementById("product-form").style.display = "none";
  document.getElementById("overlay").style.display = "none";
}

function saveProduct() {
  if (editingId) {
    updateProduct();
  } else {
    addProduct();
  }
}

async function addProduct() {
  const product = {
    title: document.getElementById("prod-title").value,
    price: Number(document.getElementById("prod-price").value),
    description: document.getElementById("prod-desc").value,
    image: document.getElementById("prod-image").value,
    
  };

  const res = await fetch("https://fakestoreapi.com/products", {
    method: "POST",
    body: JSON.stringify(product),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const newProduct = await res.json();

  products.unshift(newProduct);

  displayProducts(products);

  closeForm();
}

function openEdit(id) {
  const product = products.find((p) => p.id === id);

  editingId = id;

  document.getElementById("form-title").textContent = "Edit Product";

  document.getElementById("prod-title").value = product.title;
  document.getElementById("prod-price").value = product.price;
  document.getElementById("prod-desc").value = product.description;
  document.getElementById("prod-image").value = product.image;

  document.getElementById("product-form").style.display = "flex";
  document.getElementById("overlay").style.display = "block";
}

async function updateProduct() {
  const updatedProduct = {
    title: document.getElementById("prod-title").value,
    price: Number(document.getElementById("prod-price").value),
    description: document.getElementById("prod-desc").value,
    image: document.getElementById("prod-image").value,
  };

  await fetch(`https://fakestoreapi.com/products/${editingId}`, {
    method: "PUT",
    body: JSON.stringify(updatedProduct),
    headers: {
      "Content-Type": "application/json",
    },
  });

  products = products.map((p) => p.id === editingId ? { ...p, ...updatedProduct } : p,
  );

  displayProducts(products);

  editingId = null;

  closeForm();
}

async function deleteProduct(id) {
  const confirmDelete = confirm( "Are you sure you want to delete this product?", );

  if (!confirmDelete) return;

  await fetch(`https://fakestoreapi.com/products/${id}`, {
    method: "DELETE",
  })
    .then((res) => res.json())
    .then((data) => console.log(data));

  products = products.filter((p) => p.id !== id);

  displayProducts(products);
}
