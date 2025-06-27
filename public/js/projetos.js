
  const cursos = [
    "Desenvolvimento de Sistemas",
    "Eletrotécnica",
    "Mecânica",
    "Eletromecânica",
    "Segurança do Trabalho",
    "Logística",
    "Planejamento e Controle da Produção"
  ];

  
  const containerVagas = document.getElementById("vagasContainer");
  cursos.forEach(curso => {
    const id = curso.toLowerCase().replace(/\s+/g, '-');

    const bloco = document.createElement("div");
    bloco.innerHTML = `
      <label for="vagas-${id}" class="block font-semibold mb-1 text-gray-700">Vagas - ${curso}</label>
      <input id="vagas-${id}" name="vagas[${curso}]" type="number" min="0" value="0"
        class="w-full rounded-2xl border border-indigo-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    `;
    containerVagas.appendChild(bloco);
  });


  async function cadastrarProjeto(event) {
    event.preventDefault();

    const nome = document.getElementById("nome").value;
    const descricao = document.getElementById("descricao").value;
    const objetivo = document.getElementById("objetivo").value;
    const status = document.getElementById("status").value;
    const dataInicio = document.getElementById("dataInicio").value;
    const dataFim = document.getElementById("dataFim").value;
    const id = localStorage.getItem("usuario_id");


    const vagas = {};
    cursos.forEach(curso => {
      const id = curso.toLowerCase().replace(/\s+/g, '-');
      const quantidade = parseInt(document.getElementById(`vagas-${id}`).value) || 0;
      if (quantidade > 0) {
        vagas[curso] = quantidade;
      }
    });

    const projeto = {
      nome,
      descricao,
      objetivo,
      status,
      dataInicio,
      dataFim,
      responsavel_id: id,
      vagas
     
    };

    try {
      const response = await fetch("/api/projetos/criarProjeto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(projeto)
      });

      const result = await response.json();
      if (response.ok) {
        alert("Projeto criado com sucesso!");
      } else {
        alert("Erro ao criar projeto: " + (result.error || "Erro desconhecido"));
      }
    } catch (err) {
      console.error("Erro na requisição:", err);
      alert("Erro ao criar projeto.");
    }
  }

