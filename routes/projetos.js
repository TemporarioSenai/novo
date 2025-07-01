const express = require('express');
const router = express.Router();
const db = require('../models/db');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require("fs");
const nodemailer = require('nodemailer');


const storageDocs = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/docs'));
  },
  filename: (req, file, cb) => {
    const nomeArquivo = Date.now() + "_" + file.originalname;
    cb(null, nomeArquivo);
  }
});

const uploadDocs = multer({ storage: storageDocs });



/**
 * UPLOAD de documento para o projeto
 */
router.post("/:id/uploadDocumento", uploadDocs.single("arquivo"), (req, res) => {
  const projetoId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  const nomeArquivo = req.file.originalname;
  const caminho = "/docs/" + req.file.filename;

  db.run(`
    INSERT INTO documentos_projetos (projeto_id, nome_arquivo, caminho_arquivo)
    VALUES (?, ?, ?)
  `, [projetoId, nomeArquivo, caminho], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao salvar documento." });
    }
    res.json({ message: "Documento enviado com sucesso!" });
  });
});

/**
 * LISTAR documentos de um projeto
 */
router.get("/:id/documentos", (req, res) => {
  const projetoId = req.params.id;
  db.all(`
    SELECT * FROM documentos_projetos
    WHERE projeto_id = ?
  `, [projetoId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao buscar documentos." });
    }
    res.json(rows);
  });
});

/**
 * REMOVER documento
 */
router.delete("/documentos/:documentoId", (req, res) => {
  const documentoId = req.params.documentoId;

  db.get(`
    SELECT * FROM documentos_projetos WHERE id = ?
  `, [documentoId], (err, doc) => {
    if (err || !doc) {
      return res.status(404).json({ error: "Documento não encontrado." });
    }

    // remove do banco
    db.run(`
      DELETE FROM documentos_projetos WHERE id = ?
    `, [documentoId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro ao remover documento do banco." });
      }

      // remove do filesystem
      fs.unlink(path.join(__dirname, "../public", doc.caminho_arquivo), (err) => {
        if (err) {
          console.warn("Erro ao remover arquivo físico, mas removido do banco.", err);
        }
        res.json({ message: "Documento removido com sucesso." });
      });
    });
  });
});





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

            // para cada curso dentro do projeto, contar vagas preenchidas
            const vagasComOcupacao = vagas.map(v => {
              return new Promise((resvaga, rejvaga) => {
                db.get(
                  `SELECT COUNT(*) as ocupadas
                   FROM participacoes pa
                   JOIN usuarios u ON u.id = pa.aluno_id
                   JOIN usuario_cursos uc ON uc.usuario_id = u.id
                   JOIN cursos c ON c.id = uc.curso_id
                   WHERE pa.projeto_id = ? AND c.curso = ? AND pa.aprovado = 1`,
                  [projeto.id, v.curso],
                  (err, ocupadas) => {
                    if (err) rejvaga(err);
                    else resvaga({
                      curso: v.curso,
                      vagas_total: v.vagas_total,
                      vagas_ocupadas: ocupadas.ocupadas
                    });
                  }
                );
              });
            });

            Promise.all(vagasComOcupacao)
              .then(result => resolve({ ...projeto, vagas: result }))
              .catch(reject);
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


router.get("/testarProjeto", (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT foto FROM usuarios WHERE id = 2;`,
    [id],
    (err, projeto) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro ao buscar projeto" });
      }
      res.json(projeto);
    }
  );
});





/* -------------------------------------------
  LISTAR SOLICITAÇÕES PENDENTES DO RESPONSÁVEL
---------------------------------------------- */
router.get("/:responsavelId/solicitacoes", (req, res) => {
  const { responsavelId } = req.params;
db.all(`
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
    u.foto as aluno_foto,
    c.curso as aluno_curso,
    p.nome as projeto_nome
  FROM participacoes pa
  JOIN usuarios u ON u.id = pa.aluno_id
  JOIN projetos p ON p.id = pa.projeto_id
  LEFT JOIN usuario_cursos uc ON uc.usuario_id = u.id
  LEFT JOIN cursos c ON c.id = uc.curso_id
  WHERE p.responsavel_id = ? AND pa.aprovado = 0
`, [responsavelId], (err, rows) => {
  if (err) {
    console.error("Erro ao buscar solicitações:", err);
    return res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
  res.json(rows);
});
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

//meus projetos
router.get("/meus/:usuarioId", (req, res) => {
  const { usuarioId } = req.params;

  db.all(`
    SELECT p.*, u.nome as responsavel
    FROM projetos p
    JOIN usuarios u ON u.id = p.responsavel_id
    WHERE p.responsavel_id = ?
  `, [usuarioId], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar meus projetos:", err);
      return res.status(500).json({ error: "Erro ao buscar seus projetos." });
    }
    res.json(rows);
  });
});





router.get("/participando/:usuarioId", (req, res) => {
  const { usuarioId } = req.params;

  db.all(`
    SELECT p.*, pa.funcao, pa.aprovado, pa.id as participacao_id
    FROM participacoes pa
    JOIN projetos p ON p.id = pa.projeto_id
    WHERE pa.aluno_id = ? AND pa.aprovado = 1
  `, [usuarioId], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar projetos participando:", err);
      return res.status(500).json({ error: "Erro ao buscar seus projetos." });
    }
    res.json(rows);
  });
});



//atualiza projeto
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM projetos WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao buscar projeto." });
    }
    res.json(row);
  });
});

router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const { nome, descricao, objetivo, status } = req.body;
  db.run(`
    UPDATE projetos SET nome = ?, descricao = ?, objetivo = ?, status = ?
    WHERE id = ?
  `, [nome, descricao, objetivo, status, id], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao atualizar projeto." });
    }
    res.json({ message: "Projeto atualizado com sucesso." });
  });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM projetos WHERE id = ?", [id], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao excluir projeto." });
    }
    res.json({ message: "Projeto excluído com sucesso." });
  });
});


// detalhes completos do projeto
router.get("/:id/detalhes", async (req, res) => {
  const { id } = req.params;

  try {
    // busca dados do projeto
    const projeto = await new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM projetos WHERE id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // busca vagas do projeto
    const vagas = await new Promise((resolve, reject) => {
      db.all(`
        SELECT curso, vagas_total FROM vagas_projetos WHERE projeto_id = ?
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // busca participantes aprovados
    const participantes = await new Promise((resolve, reject) => {
      db.all(`
        SELECT pa.id as participacao_id, u.nome, u.email, u.foto, pa.funcao
        FROM participacoes pa
        JOIN usuarios u ON u.id = pa.aluno_id
        WHERE pa.projeto_id = ? AND pa.aprovado = 1
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      projeto,
      vagas,
      participantes
    });

  } catch (err) {
    console.error("Erro ao buscar detalhes do projeto:", err);
    res.status(500).json({ error: "Erro ao buscar detalhes do projeto." });
  }
});



router.delete("/participacao/:participacaoId", (req, res) => {
  const { participacaoId } = req.params;

  db.run(
    `DELETE FROM participacoes WHERE id = ?`,
    [participacaoId],
    function (err) {
      if (err) {
        console.error("Erro ao sair do projeto:", err);
        return res.status(500).json({ error: "Erro ao sair do projeto." });
      }
      res.json({ message: "Saiu do projeto com sucesso." });
    }
  );
});

router.get("/debug/participacoes/:usuarioId", (req, res) => {
  const { usuarioId } = req.params;

  db.all(
    `SELECT * FROM participacoes WHERE aluno_id = ?`,
    [usuarioId],
    (err, rows) => {
      if (err) {
        console.error("Erro debug:", err);
        res.status(500).json({ error: "Erro no debug." });
      } else {
        res.json(rows);
      }
    }
  );
});


router.get("/projetos/finalizados", (req, res) => {
  const hoje = new Date().toISOString().split("T")[0];
  db.all(`
    SELECT p.*, u.nome as responsavel_nome
    FROM projetos p
    JOIN usuarios u ON u.id = p.responsavel_id
    WHERE p.data_fim <= ? AND p.status IN ('Encerrado', 'Finalizado', 'Cancelado')

  `, [hoje], async (err, projetos) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao buscar projetos finalizados." });
    }

    try {
      // Para cada projeto, buscar seus documentos
      const projetosComDocs = await Promise.all(
        projetos.map(async projeto => {
          return new Promise((resolve, reject) => {
            db.all(`
              SELECT * FROM documentos_projetos WHERE projeto_id = ?
            `, [projeto.id], (err, documentos) => {
              if (err) reject(err);
              else resolve({ ...projeto, documentos });
            });
          });
        })
      );

      res.json(projetosComDocs);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar documentos dos projetos." });
    }
  });
});









module.exports = router;