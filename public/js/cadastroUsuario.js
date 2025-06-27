function cadastrarUsuario() {

    const nomeCompleto = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value.trim();
  




    if (!nomeCompleto || !cpf || !email || !senha) {
        alert("Preencha todos os campos obrigatórios.");
        return;

    }

    const info = { nomeCompleto, cpf, email, senha };

    fetch('/api/usuarios/criarUsuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info)
    })
        .then(response => response.text())
        .then(resposta => alert(resposta))
        .catch(error => {
            console.error('Erro ao enviar as informações:', error);
            alert('Ocorreu um erro ao enviar os dados. Verifique sua conexão e tente novamente.');
        });
}
