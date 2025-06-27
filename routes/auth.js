const express = require('express');
const router = express.Router();
const db = require('../models/db');
const path = require('path');
const bcrypt = require("bcrypt");

router.post("/login", (req, res) => {
  const { valor, senha } = req.body;

  if (!valor || !senha) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }

  const query = `SELECT * FROM usuarios WHERE email = ? OR cpf = ?`;

  db.get(query, [valor, valor], async (err, row) => {
    if (err) {
      console.error("Erro no login:", err);
      return res.status(500).json({ error: "Erro no servidor. Tente novamente." });
    }

    if (!row) {
      return res.status(401).json({ error: "Email ou CPF incorreto(s)." });
    }

    const senhaCorreta = await bcrypt.compare(senha, row.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    // LOGIN OK — envia apenas nome e email
  return res.json({
  usuario: {
    id: row.id,
    nome: row.nome,
    email: row.email
  },
  redirect: "/projetos.html"
});

  });
});


module.exports = router;

