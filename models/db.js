const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '../database/senai.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar no banco:', err);
  } else {
    console.log('Banco conectado com sucesso!');
    criarTabelas();
    //deletarColuna();
    //deletarLinha();
    //adicionarCursos();
    //adicionarHardskills();
    //deletarTabela();

  }
});

function deletarColuna() {

  db.run(`
ALTER TABLE cursos DROP COLUMN aluno_id;
  `);

}


function deletarLinha() {

  db.run(`
DELETE FROM cursos WHERE id = 8;
  `);

}

function deletarTabela() {

  db.run(`
PRAGMA foreign_keys = OFF;
DROP TABLE cursos;

  `);

}

function adicionarCursos() {
  db.run(`
INSERT INTO cursos (curso)
VALUES ("PLANEJAMENTO E CONTROLE DA PRODUÇÃO");
	
);

  `);
}
function adicionarHardskills() {
        const habilidades = [
  'Comunicação eficaz',
  'Trabalho em equipe',
  'Liderança',
  'Pensamento crítico',
  'Resolução de problemas',
  'Proatividade',
  'Organização',
  'Gestão do tempo',
  'Adaptabilidade',
  'Empatia',
  'Ética profissional',
  'Responsabilidade',
  'Criatividade',
  'Inteligência emocional',
  'Foco em resultados',
  'Tomada de decisão',
  'Atenção aos detalhes',
  'Habilidade para feedback',
  'Colaboração interdisciplinar',
  'Capacidade de negociação',
  'Autoconfiança',
  'Disciplina',
  'Escuta ativa',
  'Gestão de conflitos',
  'Comprometimento',
  'Relacionamento interpessoal'
];
  
  const stmt = db.prepare("INSERT OR IGNORE INTO softskills (skill) VALUES (?)");

  
  habilidades.forEach(habilidade => {
    stmt.run(habilidade);
  });

  
  stmt.finalize(() => {
    console.log("Habilidades inseridas com sucesso!");
  });
}






function criarTabelas() {

  //Usuarios
  db.run(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  idade INTEGER,
  turma TEXT,
  modulo TEXT,
  foto TEXT,
  biografia TEXT,
  portfolio TEXT
);

  `);

  // Habilidades Tecnicas
  db.run(`
CREATE TABLE IF NOT EXISTS hardskills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habilidade TEXT
);




    )
  `);

  // Soft Skills
  db.run(`
CREATE TABLE IF NOT EXISTS softskills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill TEXT
);


  `);

  //Cursos
  db.run(`
   CREATE TABLE IF NOT EXISTS cursos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  curso TEXT
);


  `);

  //usuario Cursos
  db.run(`
 CREATE TABLE IF NOT EXISTS usuario_cursos (
  usuario_id INTEGER,
  curso_id INTEGER,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  PRIMARY KEY (usuario_id, curso_id)
);

  `);

  //usuario hardskills
  db.run(`
CREATE TABLE IF NOT EXISTS usuario_hardskills (
  usuario_id INTEGER,
  hardskill_id INTEGER,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (hardskill_id) REFERENCES hardskills(id),
  PRIMARY KEY (usuario_id, hardskill_id)
);


  `);

  //usuario softskills
  db.run(`
CREATE TABLE IF NOT EXISTS usuario_softskills (
  usuario_id INTEGER,
  softskill_id INTEGER,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (softskill_id) REFERENCES softskills(id),
  PRIMARY KEY (usuario_id, softskill_id)
);
  `);

  // Projetos
  db.run(`
  CREATE TABLE IF NOT EXISTS projetos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nome	TEXT NOT NULL,
	descricao	TEXT,
	objetivo	TEXT,
	curso_relacionado	TEXT,
	responsavel_id	INTEGER,
	status	TEXT,
	data_inicio	DATE,
	data_fim	DATE,
	FOREIGN KEY(responsavel_id) REFERENCES "usuarios"(id)
);

  `);

  // Participações Ligações Alunos e Projetos
  db.run(`
 CREATE TABLE IF NOT EXISTS participacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER,
    projeto_id INTEGER,
    funcao TEXT, -- exemplo: líder, desenvolvedor, etc.
    aprovado BOOLEAN DEFAULT 0,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id),
    FOREIGN KEY (projeto_id) REFERENCES projetos(id)
);

  `);

  // Documentos dos Projetos
  db.run(`
   CREATE TABLE IF NOT EXISTS documentos_projetos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER,
    nome_arquivo TEXT,
    caminho_arquivo TEXT,
    data_upload DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id)
);

  `);

  db.run(`
CREATE TABLE IF NOT EXISTS vagas_projetos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id INTEGER,
  curso TEXT,
  vagas_total INTEGER,
  FOREIGN KEY (projeto_id) REFERENCES projetos(id)
);

  `);

  



}

module.exports = db;

