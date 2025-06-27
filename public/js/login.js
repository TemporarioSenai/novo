function Logar(event) {
    event.preventDefault();
  const valor = document.getElementById('valor').value.trim();
  const senha = document.getElementById('senha').value.trim();

  if (!valor || !senha) {
    alert("Preencha todos os campos.");
    return;
  }

  const info = { valor, senha };
  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor, senha })
  })
    .then(res => res.json())
    .then(data => {
      if (data.usuario) {
        // Salva nome e email no localStorage
        localStorage.setItem("usuario_id", data.usuario.id);
        localStorage.setItem("usuario_nome", data.usuario.nome);
        localStorage.setItem("usuario_email", data.usuario.email);

        // Redireciona para projetos.html
        window.location.href = data.redirect;
      } else {
        alert(data.error);
      }
    });

}
