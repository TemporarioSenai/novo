function toggleMenu() {
  document.getElementById("menuMobile").classList.toggle("-translate-x-full");
}

async function carregarMeusProjetos() {
  try {
    const usuarioId = localStorage.getItem("usuario_id");
    if (!usuarioId) {
      alert("Faça login novamente.");
      window.location.href = "index.html";
      return;
    }

    // projetos criados
    const resCriados = await fetch(`/api/projetos/meus/${usuarioId}`);
    const projetosCriados = await resCriados.json();
    const meusContainer = document.getElementById("meus-projetos-container");
    meusContainer.innerHTML = "";

    projetosCriados.forEach(p => {
      const card = document.createElement("div");
      card.className = "bg-white p-4 rounded shadow border border-[#6c9add]";
      card.innerHTML = `
        <h3 class="text-xl font-semibold text-[#356bba] mb-2">${p.nome}</h3>
        <p><strong>Descrição:</strong> ${p.descricao}</p>
        <p><strong>Status:</strong> ${p.status}</p>
        <div class="flex gap-2 mt-3 flex-wrap">
          <button class="bg-[#5083cb] hover:bg-[#87b2ee] text-white px-3 py-1 rounded" onclick="editarProjeto(${p.id})">Editar</button>
          <button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded" onclick="excluirProjeto(${p.id})">Excluir</button>
        </div>
      `;
      meusContainer.appendChild(card);
    });

    // projetos participando
    const resParticipando = await fetch(`/api/projetos/participando/${usuarioId}`);
    const participando = await resParticipando.json();
    const partContainer = document.getElementById("projetos-participando-container");
    partContainer.innerHTML = "";

    participando.forEach(p => {
      const card = document.createElement("div");
      card.className = "bg-white p-4 rounded shadow border border-[#6c9add]";
      card.innerHTML = `
        <h3 class="text-xl font-semibold text-[#356bba] mb-2">${p.nome}</h3>
        <p><strong>Descrição:</strong> ${p.descricao}</p>
        <p><strong>Função:</strong> ${p.funcao}</p>
        <p><strong>Status:</strong> ${p.status}</p>
        <button onclick="sairProjeto(${p.participacao_id})"
          class="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition">
          Sair do projeto
        </button>
      `;
      partContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar projetos.");
  }
}

async function editarProjeto(projetoId) {
  try {
    const res = await fetch(`/api/projetos/${projetoId}/detalhes`);
    const detalhes = await res.json();

    const projeto = detalhes.projeto;
    const vagas = detalhes.vagas;
    const participantes = detalhes.participantes;

    document.getElementById("editar-id").value = projeto.id;
    document.getElementById("editar-nome").value = projeto.nome;
    document.getElementById("editar-descricao").value = projeto.descricao;
    document.getElementById("editar-objetivo").value = projeto.objetivo;
    document.getElementById("editar-status").value = projeto.status;
    document.getElementById("editar-data-inicio").value = projeto.data_inicio;
    document.getElementById("editar-data-fim").value = projeto.data_fim;

    const participantesContainer = document.getElementById("editar-participantes-container");
    participantesContainer.innerHTML = "";
    participantes.forEach(p => {
      participantesContainer.innerHTML += `
        <div class="border rounded p-2 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <img src="/image/${p.foto}" class="w-8 h-8 rounded-full border" />
            <span>${p.nome} (${p.funcao})</span>
          </div>
          <button onclick="removerParticipante(${p.participacao_id})" class="text-red-600 hover:text-red-800">
            <i class="fas fa-trash"></i> Remover
          </button>
        </div>
      `;
    });

    document.getElementById("modalEditar").classList.remove("hidden");
    document.getElementById("modalEditar").classList.add("flex");

    carregarDocumentos(projeto.id);

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar detalhes do projeto.");
  }
}

async function enviarDocumento() {
  const arquivoInput = document.getElementById("arquivoDocumento");
  const projetoId = document.getElementById("editar-id").value;

  if (!arquivoInput.files.length) {
    alert("Selecione um arquivo primeiro!");
    return;
  }

  const formData = new FormData();
  formData.append("arquivo", arquivoInput.files[0]);

  try {
    const res = await fetch(`/api/projetos/${projetoId}/uploadDocumento`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    if (res.ok) {
      alert("Documento enviado com sucesso!");
      arquivoInput.value = "";
      carregarDocumentos(projetoId);
    } else {
      alert(`Erro: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao enviar documento.");
  }
}

async function carregarDocumentos(projetoId) {
  try {
    const res = await fetch(`/api/projetos/${projetoId}/documentos`);
    const docs = await res.json();
    const ul = document.getElementById("lista-documentos");
    ul.innerHTML = "";

    docs.forEach(doc => {
      ul.innerHTML += `
        <li class="flex items-center justify-between">
          <a href="${doc.caminho_arquivo}" target="_blank" class="text-[#5083cb] hover:underline flex items-center gap-2">
            <i class="fas fa-file-alt"></i> ${doc.nome_arquivo}
          </a>
          <div class="flex gap-2">
            <a href="${doc.caminho_arquivo}" download class="text-green-600 hover:text-green-800" title="Baixar arquivo">
              <i class="fas fa-download"></i>
            </a>
            <button onclick="removerDocumento(${doc.id})" class="text-red-600 hover:text-red-800 ml-2" title="Remover arquivo">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </li>
      `;
    });
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar documentos.");
  }
}


async function removerDocumento(docId) {
  if (!confirm("Deseja realmente remover este documento?")) return;
  try {
    const res = await fetch(`/api/projetos/documentos/${docId}`, { method: "DELETE" });
    if (res.ok) {
      alert("Documento removido com sucesso!");
      carregarDocumentos(document.getElementById("editar-id").value);
    } else {
      alert("Erro ao remover documento.");
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao remover documento.");
  }
}

async function sairProjeto(participacaoId) {
  if (!confirm("Tem certeza que deseja sair deste projeto?")) return;
  try {
    const res = await fetch(`/api/projetos/participacao/${participacaoId}`, { method: "DELETE" });
    if (res.ok) {
      alert("Você saiu do projeto!");
      carregarMeusProjetos();
    } else {
      alert("Erro ao sair do projeto.");
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao sair do projeto.");
  }
}

async function excluirProjeto(projetoId) {
  if (!confirm("Deseja realmente excluir este projeto?")) return;
  try {
    const res = await fetch(`/api/projetos/${projetoId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      alert("Projeto excluído com sucesso!");
      carregarMeusProjetos();
    } else {
      alert(`Erro: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao excluir projeto.");
  }
}

async function removerParticipante(participacaoId) {
  if (!confirm("Deseja realmente remover este participante?")) return;
  try {
    const res = await fetch(`/api/projetos/solicitacoes/${participacaoId}/recusar`, { method: "DELETE" });
    if (res.ok) {
      alert("Participante removido!");
      editarProjeto(document.getElementById("editar-id").value);
    } else {
      alert("Erro ao remover participante.");
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao remover participante.");
  }
}

document.getElementById("formEditarProjeto").addEventListener("submit", async function (e) {
  e.preventDefault();
  const id = document.getElementById("editar-id").value;
  const nome = document.getElementById("editar-nome").value;
  const descricao = document.getElementById("editar-descricao").value;
  const objetivo = document.getElementById("editar-objetivo").value;
  const status = document.getElementById("editar-status").value;
  const data_inicio = document.getElementById("editar-data-inicio").value;
  const data_fim = document.getElementById("editar-data-fim").value;

  try {
    const res = await fetch(`/api/projetos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, descricao, objetivo, status, data_inicio, data_fim })
    });
    if (res.ok) {
      alert("Projeto atualizado!");
      fecharModalEditar();
      carregarMeusProjetos();
    } else {
      alert("Erro ao atualizar projeto.");
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao atualizar projeto.");
  }
});

function fecharModalEditar() {
  document.getElementById("modalEditar").classList.add("hidden");
  document.getElementById("modalEditar").classList.remove("flex");
}

carregarMeusProjetos();
