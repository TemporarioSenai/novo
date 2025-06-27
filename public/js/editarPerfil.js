let hardskillsTagify;
let softskillsTagify;

document.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem("usuario_id");

  try {
    const [cursos, hardskills, softskills] = await Promise.all([
      fetch("/api/usuarios/cursos").then(res => res.json()),
      fetch("/api/usuarios/hardskills").then(res => res.json()),
      fetch("/api/usuarios/softskills").then(res => res.json())
    ]);


    hardskillsTagify = new Tagify(document.querySelector('#hardskills'), {
      whitelist: hardskills.map(h => h.habilidade),
      dropdown: { enabled: 1, maxItems: 10 }
    });

    softskillsTagify = new Tagify(document.querySelector('#softskills'), {
      whitelist: softskills.map(s => s.skill),
      dropdown: { enabled: 1, maxItems: 10 }
    });


    const datalist = document.getElementById("lista-cursos");
    cursos.forEach(curso => {
      const option = document.createElement("option");
      option.value = curso.curso;
      datalist.appendChild(option);
    });


    const usuario = await fetch(`/api/usuarios/usuarios/${id}`).then(res => res.json());

    document.querySelector('input[name="nome"]').value = usuario.nome || "";
    document.querySelector('input[name="email"]').value = usuario.email || "";
    document.querySelector('input[name="idade"]').value = usuario.idade || "";
    document.querySelector('select[name="modulo"]').value = usuario.modulo || "";
    document.querySelector('input[name="turma"]').value = usuario.turma || "";
    document.querySelector('textarea[name="biografia"]').value = usuario.biografia || "";
    document.querySelector('input[name="portfolio"]').value = usuario.portfolio || "";
    document.querySelector('input[name="curso"]').value = usuario.cursos?.[0] || "";

    if (usuario.foto) {
      document.getElementById("preview-foto").src = `/image/${usuario.foto}`;
    }

    setTimeout(() => {
      if (usuario.hardskills?.length) {
        hardskillsTagify.addTags(usuario.hardskills);
      }
      if (usuario.softskills?.length) {
        softskillsTagify.addTags(usuario.softskills);
      }
    }, 100);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    alert("Erro ao carregar dados do perfil.");
  }
});


document.getElementById("foto").addEventListener("change", function () {
  const file = this.files[0];
  const preview = document.getElementById("preview-foto");

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});


document.getElementById("form-editar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = localStorage.getItem("usuario_id");
  const form = e.target;
  const formData = new FormData(form);

  const cursoValor = document.querySelector("#curso").value;
  formData.set("curso", cursoValor);


  try {

    const responsePerfil = await fetch(`/api/usuarios/usuarios/${id}`, {
      method: "PATCH",
      body: formData
    });

    const resultPerfil = await responsePerfil.json();

    if (!resultPerfil.message) {
      alert(resultPerfil.error || "Erro ao atualizar o perfil.");
      return;
    }


    const hards = hardskillsTagify.value.map(tag => tag.value);
    const softs = softskillsTagify.value.map(tag => tag.value);

    const responseSkills = await fetch(`/api/usuarios/usuarios/${id}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hardskills: hards, softskills: softs })
    });

    const resultSkills = await responseSkills.json();

    if (!resultSkills.message) {
      alert(resultSkills.error || "Erro ao salvar as skills.");
      return;
    }


    alert("Perfil atualizado com sucesso!");
    localStorage.setItem("usuario_nome", formData.get("nome"));
    localStorage.setItem("usuario_email", formData.get("email"));
  } catch (err) {
    console.error("Erro ao enviar dados:", err);
    alert("Erro ao atualizar perfil.");
  }
});
