const id = window.location.search.split("=")[1];

fetch(`https://fakestoreapi.com/products/${id}`)
.then(res => res.json())
.then(product => {

document.getElementById("title").textContent = product.title;

document.getElementById("price").textContent = "$" + product.price;

document.getElementById("description").textContent = product.description;

document.getElementById("rating").textContent = product.rating.rate + " / 5";

document.getElementById("main-image").src = product.image;

document.getElementById("thumb1").src = product.image;
document.getElementById("thumb2").src = product.image;
document.getElementById("thumb3").src = product.image;

});