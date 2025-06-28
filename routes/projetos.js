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

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "coordenacaoprojetos.senai@gmail.com",
    pass: "myag bvns eoqw gatn"
  }
});

/* -------------------------------------------
  LISTAR TODOS OS PROJETOS DISPONÍVEIS
---------------------------------------------- */
router.get("/listarProjeto", async (req, res) => {
  try {
    const projetos = await db.all(`
      SELECT p.*, u.nome as responsavel_nome
      FROM projetos p
      LEFT JOIN usuarios u ON u.id = p.responsavel_id
    `);
    res.json(projetos);
  } catch (err) {
    console.error("Erro ao listar projetos:", err);
    res.status(500).json({ error: "Erro ao listar projetos." });
  }
});

/* -------------------------------------------
  CANDIDATAR-SE A UM PROJETO
---------------------------------------------- */
router.post("/projetos/:id/candidatar", async (req, res) => {
  const projetoId = req.params.id;
  const alunoId = req.body.alunoId;

  try {
    // primeiro grava a solicitação no banco
    await db.run(`
      INSERT INTO participacoes (aluno_id, projeto_id, funcao, aprovado)
      VALUES (?, ?, ?, 0)
    `, [alunoId, projetoId, "participante"]);

    // depois envia o email de notificação
    db.get("SELECT * FROM usuarios WHERE id = ?", [alunoId], (err, aluno) => {
      if (err || !aluno) return res.status(404).json({ error: "Aluno não encontrado" });

      db.get(`
        SELECT c.curso FROM usuario_cursos uc
        JOIN cursos c ON uc.curso_id = c.id
        WHERE uc.usuario_id = ?
      `, [alunoId], (err, cursoRow) => {
        const curso = cursoRow ? cursoRow.curso : "Não informado";

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

            db.get("SELECT * FROM projetos WHERE id = ?", [projetoId], (err, projeto) => {
              if (!projeto) return res.status(404).json({ error: "Projeto não encontrado" });

              db.get("SELECT * FROM usuarios WHERE id = ?", [projeto.responsavel_id], (err, responsavel) => {
                if (!responsavel) return res.status(404).json({ error: "Responsável não encontrado" });

                const htmlEmail = `
                  <div style="font-family: Arial; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
                    <div style="background-color: #356bba; color: white; padding: 16px;">
                      <h2>Nova Solicitação de Participação</h2>
                    </div>
                    <div style="padding: 20px;">
                      <h3 style="color: #356bba;">Projeto: ${projeto.nome}</h3>
                      <p><strong>Aluno:</strong> ${aluno.nome}</p>
                      <p><strong>Email:</strong> ${aluno.email}</p>
                      <p><strong>Curso:</strong> ${curso}</p>
                      <p><strong>Habilidades Técnicas:</strong> ${hards.join(", ") || "Nenhuma"}</p>
                      <p><strong>Soft Skills:</strong> ${softs.join(", ") || "Nenhuma"}</p>
                      <p><a href="http://localhost:3000/gerenciarSolicitacoes.html" style="background:#5083cb; color:white; padding:10px 16px; border-radius:6px; text-decoration:none;">Gerenciar Solicitações</a></p>
                    </div>
                    <div style="background:#f1f1f1; text-align:center; padding:10px; font-size:12px;">SENAI Projeto Integrador &copy; 2025</div>
                  </div>
                `;

                transporter.sendMail({
                  from: "Projeto Integrador <coordenacaoprojetos.senai@gmail.com>",
                  to: responsavel.email,
                  subject: `Nova candidatura no projeto: ${projeto.nome}`,
                  html: htmlEmail
                }, (err) => {
                  if (err) {
                    console.error("Erro ao enviar email:", err);
                    return res.status(500).json({ error: "Erro ao enviar email" });
                  }
                  res.json({ message: "Solicitação enviada e salva com sucesso!" });
                });
              });
            });
          });
        });
      });
    });

  } catch (err) {
    console.error("Erro ao registrar candidatura:", err);
    res.status(500).json({ error: "Erro ao registrar candidatura." });
  }
});

/* -------------------------------------------
  LISTAR SOLICITAÇÕES PENDENTES DO RESPONSÁVEL
---------------------------------------------- */
router.get("/:responsavelId/solicitacoes", async (req, res) => {
  const { responsavelId } = req.params;

  try {
    const solicitacoes = await db.all(`
      SELECT 
        pa.id as participacao_id,
        pa.aluno_id,
        pa.projeto_id,
        pa.funcao,
        pa.aprovado,
        u.nome as aluno_nome,
        u.email as aluno_email,
        u.idade,
        u.turma,
        u.modulo,
        u.portfolio,
        u.biografia,
        p.nome as projeto_nome
      FROM participacoes pa
      JOIN usuarios u ON u.id = pa.aluno_id
      JOIN projetos p ON p.id = pa.projeto_id
      WHERE p.responsavel_id = ? AND pa.aprovado = 0
    `, [responsavelId]);
    res.json(solicitacoes);
  } catch (err) {
    console.error("Erro ao buscar solicitações:", err);
    res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});

/* -------------------------------------------
  APROVAR SOLICITAÇÃO
---------------------------------------------- */
router.patch("/solicitacoes/:participacaoId/aprovar", async (req, res) => {
  const { participacaoId } = req.params;

  try {
    await db.run("UPDATE participacoes SET aprovado = 1 WHERE id = ?", [participacaoId]);
    res.json({ message: "Solicitação aprovada com sucesso." });
  } catch (err) {
    console.error("Erro ao aprovar participação:", err);
    res.status(500).json({ error: "Erro ao aprovar participação." });
  }
});

/* -------------------------------------------
  RECUSAR SOLICITAÇÃO
---------------------------------------------- */
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