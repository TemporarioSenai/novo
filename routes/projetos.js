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

// GET /api/projetos/meusProjetosCompletos/:alunoId
router.get("/meusProjetosCompletos/:alunoId", async (req, res) => {
  const { alunoId } = req.params;

  try {
    // projetos que ele criou
    const criados = await db.all(`
      SELECT *
      FROM projetos
      WHERE responsavel_id = ?
    `, [alunoId]);

    // projetos que ele participa
    const participando = await db.all(`
      SELECT p.*
      FROM projetos p
      JOIN participacoes pa ON pa.projeto_id = p.id
      WHERE pa.aluno_id = ? AND pa.aprovado = 1
    `, [alunoId]);

    res.json({ criados, participando });
  } catch (err) {
    console.error("Erro ao buscar projetos:", err);
    res.status(500).json({ error: "Erro ao buscar projetos." });
  }
});




// buscar dados completos de um projeto
router.get("/projetos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const projeto = await db.get("SELECT * FROM projetos WHERE id = ?", [id]);
    if (!projeto) {
      return res.status(404).json({ error: "Projeto não encontrado" });
    }
    // buscar vagas vinculadas
    const vagas = await db.all("SELECT * FROM vagas_projetos WHERE projeto_id = ?", [id]);
    // buscar documentos
    const documentos = await db.all("SELECT * FROM documentos_projetos WHERE projeto_id = ?", [id]);
    res.json({ projeto, vagas, documentos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados do projeto" });
  }
});

// atualizar dados do projeto
router.put("/projetos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, objetivo, curso_relacionado, status, data_inicio, data_fim } = req.body;
  try {
    await db.run(`
      UPDATE projetos
      SET nome = ?, descricao = ?, objetivo = ?, curso_relacionado = ?, status = ?, data_inicio = ?, data_fim = ?
      WHERE id = ?
    `, [nome, descricao, objetivo, curso_relacionado, status, data_inicio, data_fim, id]);
    res.json({ message: "Projeto atualizado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar projeto" });
  }
});

// atualizar vagas do projeto
router.put("/projetos/:id/vagas", async (req, res) => {
  const { id } = req.params;
  const { vagas } = req.body; // [{curso: "Mecânica", vagas_total: 3}, ...]
  try {
    // remove vagas antigas
    await db.run("DELETE FROM vagas_projetos WHERE projeto_id = ?", [id]);
    // insere novas
    const stmt = await db.prepare("INSERT INTO vagas_projetos (projeto_id, curso, vagas_total) VALUES (?, ?, ?)");
    for (const v of vagas) {
      await stmt.run([id, v.curso, v.vagas_total]);
    }
    await stmt.finalize();
    res.json({ message: "Vagas atualizadas com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar vagas" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1) apagar participações
    await db.run("DELETE FROM participacoes WHERE projeto_id = ?", [id]);
    // 2) apagar documentos
    await db.run("DELETE FROM documentos_projetos WHERE projeto_id = ?", [id]);
    // 3) apagar vagas
    await db.run("DELETE FROM vagas_projetos WHERE projeto_id = ?", [id]);
    // 4) apagar o projeto
    await db.run("DELETE FROM projetos WHERE id = ?", [id]);

    res.send("Projeto e relacionamentos deletados com sucesso!");
  } catch (err) {
    console.error("Erro ao deletar projeto e relacionamentos:", err);
    res.status(500).send("Erro ao deletar projeto. Verifique a conexão e tente novamente.");
  }
});


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
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background-color: #356bba; color: white; padding: 16px;">
      <h2 style="margin: 0;">Nova Solicitação de Participação</h2>
    </div>
    <div style="padding: 20px;">
      <h3 style="color: #356bba;">Projeto: ${projeto.nome}</h3>
      <p><strong>Aluno:</strong> ${aluno.nome}</p>
      <p><strong>Email:</strong> ${aluno.email}</p>
      <p><strong>Curso:</strong> ${curso}</p>
      <p>Para aprovar ou recusar essa solicitação, acesse o painel no sistema:</p>
      <p><a href="http://localhost:5500/gerenciarSolicitacoes.html" style="background:#5083cb; color:white; padding:10px 16px; border-radius:6px; text-decoration:none;">Gerenciar Solicitações</a></p>
    </div>
    <div style="background-color: #f1f1f1; color: #555; text-align: center; padding: 10px; font-size: 12px;">
      SENAI - Projeto Integrador &copy; 2025
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


// GET /api/projetos/:responsavelId/solicitacoes
router.get("/:responsavelId/solicitacoes", async (req, res) => {
  const { responsavelId } = req.params;

  try {
    const sql = `
      SELECT pa.id AS participacao_id, pa.aluno_id, pa.projeto_id, pa.funcao, pa.aprovado,
             u.nome as aluno_nome, u.email as aluno_email, u.idade, u.turma, u.modulo, u.portfolio, u.biografia,
             p.nome as projeto_nome
      FROM participacoes pa
      JOIN usuarios u ON u.id = pa.aluno_id
      JOIN projetos p ON p.id = pa.projeto_id
      WHERE p.responsavel_id = ? AND pa.aprovado = 0
    `;
    const solicitacoes = await db.all(sql, [responsavelId]);
    res.json(solicitacoes);
  } catch (err) {
    console.error("Erro ao buscar solicitações:", err);
    res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});


// PATCH /api/projetos/solicitacoes/:participacaoId/aprovar
router.patch("/solicitacoes/:participacaoId/aprovar", async (req, res) => {
  const { participacaoId } = req.params;

  try {
    await db.run("UPDATE participacoes SET aprovado = 1 WHERE id = ?", [participacaoId]);
    res.json({ message: "Participação aprovada com sucesso." });
  } catch (err) {
    console.error("Erro ao aprovar participação:", err);
    res.status(500).json({ error: "Erro ao aprovar participação." });
  }
});


// DELETE /api/projetos/solicitacoes/:participacaoId/recusar
router.delete("/solicitacoes/:participacaoId/recusar", async (req, res) => {
  const { participacaoId } = req.params;

  try {
    await db.run("DELETE FROM participacoes WHERE id = ?", [participacaoId]);
    res.json({ message: "Solicitação recusada com sucesso." });
  } catch (err) {
    console.error("Erro ao recusar participação:", err);
    res.status(500).json({ error: "Erro ao recusar participação." });
  }
});




module.exports = router;