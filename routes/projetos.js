const express = require('express');
const router = express.Router();
const db = require('../models/db');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require("fs");
const nodemailer = require('nodemailer');

router.get("/listarProjetos", (req, res) => {
  const queryProjetos = `
    SELECT p.*, u.nome AS responsavel
    FROM projetos p
    JOIN usuarios u ON u.id = p.responsavel_id
  `;

  db.all(queryProjetos, [], (err, projetos) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar projetos." });

    const promises = projetos.map(projeto => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT curso, vagas_total FROM vagas_projetos WHERE projeto_id = ?`,
          [projeto.id],
          (err, vagas) => {
            if (err) reject(err);
            else resolve({ ...projeto, vagas });
          }
        );
      });
    });

    Promise.all(promises)
      .then(result => res.json(result))
      .catch(() => res.status(500).json({ error: "Erro ao buscar vagas." }));
  });
});





router.post("/criarProjeto", (req, res) => {
  const {
    nome,
    descricao,
    objetivo,
    status,
    dataInicio,
    dataFim,
    responsavel_id,
    vagas
  } = req.body;

  const cursoRelacionado = Object.keys(vagas).join(", ");

  const queryProjeto = `
    INSERT INTO projetos (
      nome, descricao, objetivo, curso_relacionado, responsavel_id, status, data_inicio, data_fim
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    nome,
    descricao,
    objetivo,
    cursoRelacionado,
    responsavel_id,
    status,
    dataInicio,
    dataFim
  ];

  db.run(queryProjeto, params, function (err) {
    if (err) {
      console.error("Erro ao inserir projeto:", err);
      return res.status(500).json({ error: "Erro ao criar projeto." });
    }

    const projetoId = this.lastID;

    
    const insertVagas = Object.entries(vagas).map(([curso, quantidade]) => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO vagas_projetos (projeto_id, curso, vagas_total) VALUES (?, ?, ?)`,
          [projetoId, curso, quantidade],
          (err) => {
            if (err) {
              console.error("Erro ao inserir vaga:", err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    });

    Promise.all(insertVagas)
      .then(() => res.json({ message: "Projeto criado com sucesso!" }))
      .catch(() => res.status(500).json({ error: "Erro ao salvar as vagas do projeto." }));
  });
});

// Deletar Projetos
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM projetos WHERE id = ?";

  db.run(query, [id], (err) => {
    if (err) {
      console.error("Erro ao deletar projeto:", err);
      return res
        .status(500)
        .send("Erro ao deletar projeto. Verifique a conexão e tente novamente.");
    }
    res.send("Projeto deletado com sucesso!");
  });
});



router.patch("/")










const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "coordenacaoprojetos.senai@gmail.com",
    pass: "myag bvns eoqw gatn"
  }
});
router.post("/projetos/:id/candidatar", async (req, res) => {
  const projetoId = req.params.id;
  const alunoId = req.body.alunoId;

  try {
    // Buscar dados do aluno
    db.get("SELECT * FROM usuarios WHERE id = ?", [alunoId], (err, aluno) => {
      if (err || !aluno) return res.status(404).json({ error: "Aluno não encontrado" });

      // Buscar curso
      db.get(`
        SELECT c.curso FROM usuario_cursos uc
        JOIN cursos c ON uc.curso_id = c.id
        WHERE uc.usuario_id = ?
      `, [alunoId], (err, cursoRow) => {
        const curso = cursoRow ? cursoRow.curso : "Não informado";

        // Buscar skills
        db.all(`
          SELECT h.habilidade FROM usuario_hardskills uh
          JOIN hardskills h ON uh.hardskill_id = h.id
          WHERE uh.usuario_id = ?
        `, [alunoId], (err, hardskills) => {
          const hards = hardskills.map(h => h.habilidade);

          db.all(`
            SELECT s.skill FROM usuario_softskills us
            JOIN softskills s ON us.softskill_id = s.id
            WHERE us.usuario_id = ?
          `, [alunoId], (err, softskills) => {
            const softs = softskills.map(s => s.skill);

            // Buscar projeto e responsável
            db.get("SELECT * FROM projetos WHERE id = ?", [projetoId], (err, projeto) => {
              if (!projeto) return res.status(404).json({ error: "Projeto não encontrado" });

              db.get("SELECT * FROM usuarios WHERE id = ?", [projeto.responsavel_id], (err, responsavel) => {
                if (!responsavel) return res.status(404).json({ error: "Responsável não encontrado" });

                const htmlEmail = `
                  <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #2a3cac;">Solicitação de Participação no Projeto: ${projeto.nome}</h2>
                    <p><strong>Nome:</strong> ${aluno.nome}</p>
                    <p><strong>Email:</strong> ${aluno.email}</p>
                    <p><strong>Curso:</strong> ${curso}</p>
                    <p><strong>Idade:</strong> ${aluno.idade || "Não informado"}</p>
                    <p><strong>Módulo:</strong> ${aluno.modulo || "Não informado"}</p>
                    <p><strong>Turma:</strong> ${aluno.turma || "Não informado"}</p>
                    <p><strong>Portfólio:</strong> <a href="${aluno.portfolio || '#'}" target="_blank">${aluno.portfolio || "Não informado"}</a></p>
                    <p><strong>Biografia:</strong> ${aluno.biografia || "Não informado"}</p>
                    <p><strong>Habilidades Técnicas:</strong> ${hards.join(', ') || "Nenhuma"}</p>
                    <p><strong>Soft Skills:</strong> ${softs.join(', ') || "Nenhuma"}</p>
                    <div style="margin-top: 20px;">
                      <a href="http://localhost:3000/api/projetos/${projetoId}/aceitar/${alunoId}" style="background: #28a745; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; margin-right: 10px;">✅ Aceitar Participação</a>
                      <a href="http://localhost:3000/api/projetos/${projetoId}/recusar/${alunoId}" style="background: #dc3545; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none;">❌ Recusar Participação</a>
                    </div>
                  </div>
                `;

                transporter.sendMail({
                  from: "Projeto Integrador <coordenacaoprojetos.senai@gmail.com>",
                  to: responsavel.email,
                  subject: `Nova candidatura no projeto: ${projeto.nome}`,
                  html: htmlEmail
                }, (err, info) => {
                  if (err) return res.status(500).json({ error: "Erro ao enviar e-mail" });
                  res.json({ message: "Candidatura enviada com sucesso!" });
                });
              });
            });
          });
        });
      });
    });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Aceitar participação
router.get("/projetos/:id/aceitar/:alunoId", (req, res) => {
  const { id, alunoId } = req.params;

  db.run(`
    UPDATE participacoes SET aprovado = 1
    WHERE projeto_id = ? AND aluno_id = ?
  `, [id, alunoId], function (err) {
    if (err) {
      return res.status(500).send("Erro ao aprovar participação.");
    }
    res.send("Participação aprovada com sucesso.");
  });
});

// Recusar participação (opcional: pode excluir ou manter)
router.get("/projetos/:id/recusar/:alunoId", (req, res) => {
  const { id, alunoId } = req.params;

  db.run(`
    DELETE FROM participacoes
    WHERE projeto_id = ? AND aluno_id = ?
  `, [id, alunoId], function (err) {
    if (err) {
      return res.status(500).send("Erro ao recusar participação.");
    }
    res.send("Participação recusada com sucesso.");
  });
});



module.exports = router;